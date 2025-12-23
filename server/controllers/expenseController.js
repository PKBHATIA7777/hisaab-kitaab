/* server/controllers/expenseController.js */
const db = require("../config/db");
const { z } = require("zod");
const xss = require("xss"); // Secure input (Phase 1)

// --- VALIDATION SCHEMA ---
const addExpenseSchema = z.object({
  chapterId: z.string().or(z.number()),
  amount: z.number().positive("Amount must be greater than 0"),
  description: z.string().max(100, "Description too long").optional(),
  payerMemberId: z.string().or(z.number()),
  
  // Option A: Equal Split (Existing)
  involvedMemberIds: z.array(z.string().or(z.number())).optional(),
  
  // Option B: Unequal Split (New Feature Support)
  // Expects: [{ memberId: 1, amount: 50 }, { memberId: 2, amount: 150 }]
  customSplits: z.array(z.object({
    memberId: z.string().or(z.number()),
    amount: z.number().positive()
  })).optional()
}).refine(data => data.involvedMemberIds || data.customSplits, {
  message: "Either involvedMemberIds or customSplits must be provided"
});

async function addExpense(req, res) {
  try {
    const result = addExpenseSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    }

    const { chapterId, amount, payerMemberId, involvedMemberIds, customSplits } = result.data;
    const description = xss(result.data.description || ""); // Sanitized
    const userId = req.user.userId;

    // 1. Verify Access
    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) {
      return res.status(403).json({ ok: false, message: "Unauthorized or Chapter not found" });
    }

    // 2. MATH LOGIC (INTEGER MODE)
    // Convert total to "cents" to avoid float errors
    const totalCents = Math.round(amount * 100);
    const finalSplits = []; // Stores { memberId, amount }

    if (customSplits && customSplits.length > 0) {
      // --- Handle Custom/Unequal Splits ---
      let splitSumCents = 0;
      customSplits.forEach(s => {
        const c = Math.round(s.amount * 100);
        splitSumCents += c;
        finalSplits.push({ memberId: s.memberId, amount: c / 100 });
      });

      // Validation: Sum must match total
      if (Math.abs(splitSumCents - totalCents) > 1) { // 1 cent tolerance
        return res.status(400).json({ 
          ok: false, 
          message: `Splits sum (${splitSumCents/100}) does not match Total (${amount})` 
        });
      }
    } else {
      // --- Handle Equal Splits ---
      const count = involvedMemberIds.length;
      if (count === 0) return res.status(400).json({ ok: false, message: "No members involved" });

      const baseShareCents = Math.floor(totalCents / count);
      let remainderCents = totalCents % count;

      involvedMemberIds.forEach(mId => {
        let myShareCents = baseShareCents;
        // Distribute remainder 1 cent at a time
        if (remainderCents > 0) {
          myShareCents += 1;
          remainderCents--;
        }
        finalSplits.push({ memberId: mId, amount: myShareCents / 100 });
      });
    }

    // 3. DATABASE TRANSACTION
    await db.query("BEGIN");

    try {
      // A. Insert Main Expense
      const { rows: expenseRows } = await db.query(
        `INSERT INTO expenses (chapter_id, payer_member_id, amount, description, expense_date)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, created_at`,
        [chapterId, payerMemberId, amount, description]
      );
      const expenseId = expenseRows[0].id;

      // B. Insert Splits
      for (const split of finalSplits) {
        await db.query(
          `INSERT INTO expense_splits (expense_id, member_id, amount_owed)
           VALUES ($1, $2, $3)`,
          [expenseId, split.memberId, split.amount]
        );
      }

      await db.query("COMMIT");

      res.json({ 
        ok: true, 
        message: "Expense added", 
        expense: { 
          id: expenseId, 
          amount, 
          description, 
          date: expenseRows[0].created_at 
        } 
      });

    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }

  } catch (err) {
    console.error("addExpense error:", err);
    res.status(500).json({ ok: false, message: "Failed to add expense" });
  }
}

// Get Expenses for a Chapter (Simple List) - UNCHANGED
async function getChapterExpenses(req, res) {
  try {
    const { chapterId } = req.params;
    const userId = req.user.userId;

    // Verify Access
    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized" });

    // Fetch Expenses with Payer Name
    const { rows } = await db.query(
      `SELECT e.id, e.amount, e.description, e.expense_date, cm.member_name as payer_name
       FROM expenses e
       JOIN chapter_members cm ON e.payer_member_id = cm.id
       WHERE e.chapter_id = $1
       ORDER BY e.expense_date DESC`,
      [chapterId]
    );

    res.json({ ok: true, expenses: rows });
  } catch (err) {
    console.error("getExpenses error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// Delete Expense - UNCHANGED
async function deleteExpense(req, res) {
  try {
    const { id } = req.params; // expense id
    const userId = req.user.userId;

    // Check ownership via join
    const { rows } = await db.query(
      `SELECT e.id FROM expenses e 
       JOIN chapters c ON e.chapter_id = c.id
       WHERE e.id = $1 AND c.created_by = $2`,
      [id, userId]
    );

    if (rows.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized or not found" });

    await db.query("DELETE FROM expenses WHERE id = $1", [id]);
    res.json({ ok: true, message: "Expense deleted" });

  } catch (err) {
    console.error("deleteExpense error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// Get Expense Summary - UNCHANGED
async function getExpenseSummary(req, res) {
  try {
    const { chapterId } = req.params;
    const userId = req.user.userId;

    // Verify Access
    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized" });

    // New Query: Calculates both Spent (Payer) and Used (Consumer)
    const queryText = `
      WITH spent_cte AS (
        SELECT payer_member_id, SUM(amount) as total
        FROM expenses WHERE chapter_id = $1 GROUP BY payer_member_id
      ),
      used_cte AS (
        SELECT es.member_id, SUM(es.amount_owed) as total
        FROM expense_splits es
        JOIN expenses e ON es.expense_id = e.id
        WHERE e.chapter_id = $1
        GROUP BY es.member_id
      )
      SELECT 
        cm.id as member_id, 
        cm.member_name, 
        COALESCE(s.total, 0) as total_spent,
        COALESCE(u.total, 0) as total_used
      FROM chapter_members cm
      LEFT JOIN spent_cte s ON cm.id = s.payer_member_id
      LEFT JOIN used_cte u ON cm.id = u.member_id
      WHERE cm.chapter_id = $1
      ORDER BY total_spent DESC, total_used DESC
    `;

    const { rows } = await db.query(queryText, [chapterId]);

    // Calculate Grand Total (Spent should equal Used theoretically)
    const grandTotal = rows.reduce((acc, row) => acc + parseFloat(row.total_spent), 0);

    res.json({ 
      ok: true, 
      summary: rows,
      grandTotal: grandTotal.toFixed(2)
    });

  } catch (err) {
    console.error("getSummary error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// Get Single Expense Details - UNCHANGED
async function getExpenseDetails(req, res) {
  try {
    const { id } = req.params; // expenseId
    const userId = req.user.userId;

    // Verify ownership via join
    const { rows: expenseRows } = await db.query(
      `SELECT e.* FROM expenses e 
       JOIN chapters c ON e.chapter_id = c.id
       WHERE e.id = $1 AND c.created_by = $2`, 
      [id, userId]
    );
    if (expenseRows.length === 0) return res.status(404).json({ ok: false, message: "Not found" });

    // Get splits
    const { rows: splitRows } = await db.query(
      "SELECT member_id FROM expense_splits WHERE expense_id = $1",
      [id]
    );

    res.json({ 
      ok: true, 
      expense: expenseRows[0],
      involvedMemberIds: splitRows.map(s => s.member_id)
    });
  } catch(err) {
    console.error("getDetails error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// Update Expense - UPDATED WITH INTEGER MATH
async function updateExpense(req, res) {
  try {
    const { id } = req.params; 
    const result = addExpenseSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    }

    const { chapterId, amount, payerMemberId, involvedMemberIds, customSplits } = result.data;
    const description = xss(result.data.description || "");
    const userId = req.user.userId;

    // Verify access
    const { rows: check } = await db.query(
      `SELECT e.id, e.chapter_id FROM expenses e 
       JOIN chapters c ON e.chapter_id = c.id
       WHERE e.id = $1 AND c.created_by = $2`, 
      [id, userId]
    );
    if (check.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized" });

    // MATH LOGIC (SAME AS addExpense - INTEGER MODE)
    const totalCents = Math.round(amount * 100);
    const finalSplits = [];

    if (customSplits && customSplits.length > 0) {
      let splitSumCents = 0;
      customSplits.forEach(s => {
        const c = Math.round(s.amount * 100);
        splitSumCents += c;
        finalSplits.push({ memberId: s.memberId, amount: c / 100 });
      });
      if (Math.abs(splitSumCents - totalCents) > 1) {
        return res.status(400).json({ 
          ok: false, 
          message: `Splits sum (${splitSumCents/100}) does not match Total (${amount})` 
        });
      }
    } else {
      const count = involvedMemberIds.length;
      if (count === 0) return res.status(400).json({ ok: false, message: "No members involved" });

      const baseShareCents = Math.floor(totalCents / count);
      let remainderCents = totalCents % count;

      involvedMemberIds.forEach(mId => {
        let myShareCents = baseShareCents;
        if (remainderCents > 0) {
          myShareCents += 1;
          remainderCents--;
        }
        finalSplits.push({ memberId: mId, amount: myShareCents / 100 });
      });
    }

    await db.query("BEGIN");

    try {
      // Update Main Expense
      await db.query(
        `UPDATE expenses 
         SET amount = $1, description = $2, payer_member_id = $3, chapter_id = $4
         WHERE id = $5`,
        [amount, description, payerMemberId, chapterId, id]
      );

      // Delete Old Splits
      await db.query("DELETE FROM expense_splits WHERE expense_id = $1", [id]);

      // Insert New Splits
      for (const split of finalSplits) {
        await db.query(
          `INSERT INTO expense_splits (expense_id, member_id, amount_owed)
           VALUES ($1, $2, $3)`,
          [id, split.memberId, split.amount]
        );
      }

      await db.query("COMMIT");
      res.json({ ok: true, message: "Expense updated" });

    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error("updateExpense error:", err);
    res.status(500).json({ ok: false, message: "Update failed" });
  }
}

// =========================================================
// ✅ FIX B6 & B1: SETTLEMENT ALGORITHM (INTEGER MATH)
// =========================================================
function calculateSettlements(balances) {
  // 1. Convert everything to Cents (Integers)
  let debtors = [];
  let creditors = [];

  balances.forEach(person => {
    // Round to nearest cent
    const balanceCents = Math.round(person.balance * 100);
    
    // Ignore near-zero balances (floating point noise)
    if (balanceCents < -1) debtors.push({ ...person, balanceCents });
    else if (balanceCents > 1) creditors.push({ ...person, balanceCents });
  });

  // 2. Sort by Magnitude (Optimization)
  debtors.sort((a, b) => a.balanceCents - b.balanceCents); // Ascending (-1000 before -500)
  creditors.sort((a, b) => b.balanceCents - a.balanceCents); // Descending (1000 before 500)

  const settlements = [];
  let i = 0; 
  let j = 0; 

  // 3. Greedy Matching Loop
  while (i < debtors.length && j < creditors.length) {
    let debtor = debtors[i];
    let creditor = creditors[j];

    // Amount to settle is Min(|debt|, credit)
    let amountCents = Math.min(Math.abs(debtor.balanceCents), creditor.balanceCents);

    // Record Settlement
    settlements.push({
      from: debtor.name,
      to: creditor.name,
      amount: (amountCents / 100).toFixed(2), // Convert back to float for UI
      fromId: debtor.id,
      toId: creditor.id
    });

    // Adjust Balances
    debtor.balanceCents += amountCents;
    creditor.balanceCents -= amountCents;

    // Move Pointers if settled (0 or very close to 0)
    if (Math.abs(debtor.balanceCents) < 1) i++;
    if (Math.abs(creditor.balanceCents) < 1) j++;
  }

  return settlements;
}

// Get Chapter Settlements - UPDATED TO USE NEW INTEGER MATH
async function getChapterSettlements(req, res) {
  try {
    const { chapterId } = req.params;
    const userId = req.user.userId;

    // Verify Access
    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized" });

    // New Query: Calculates both Spent (Payer) and Used (Consumer)
    const queryText = `
      WITH spent_cte AS (
        SELECT payer_member_id, SUM(amount) as total
        FROM expenses WHERE chapter_id = $1 GROUP BY payer_member_id
      ),
      used_cte AS (
        SELECT es.member_id, SUM(es.amount_owed) as total
        FROM expense_splits es
        JOIN expenses e ON es.expense_id = e.id
        WHERE e.chapter_id = $1
        GROUP BY es.member_id
      )
      SELECT 
        cm.id, 
        cm.member_name, 
        COALESCE(s.total, 0) as total_spent,
        COALESCE(u.total, 0) as total_used
      FROM chapter_members cm
      LEFT JOIN spent_cte s ON cm.id = s.payer_member_id
      LEFT JOIN used_cte u ON cm.id = u.member_id
      WHERE cm.chapter_id = $1
    `;

    const { rows } = await db.query(queryText, [chapterId]);

    // Prepare Balances
    const memberBalances = rows.map(row => ({
      id: row.id,
      name: row.member_name,
      // Keep as float here, algorithm handles conversion
      balance: parseFloat(row.total_spent) - parseFloat(row.total_used)
    }));

    const settlements = calculateSettlements(memberBalances);

    res.json({ ok: true, settlements });

  } catch (err) {
    console.error("getChapterSettlements error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// Exports
module.exports = {
  addExpense,
  getChapterExpenses,
  deleteExpense,
  getExpenseSummary, 
  getExpenseDetails, 
  updateExpense,     
  getChapterSettlements,
  calculateSettlements // Export for testing if needed
};
