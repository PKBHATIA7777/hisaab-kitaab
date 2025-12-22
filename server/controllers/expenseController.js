/* server/controllers/expenseController.js */
const db = require("../config/db");
const { z } = require("zod");


// --- VALIDATION SCHEMA ---
const addExpenseSchema = z.object({
  chapterId: z.string().or(z.number()),
  amount: z.number().positive("Amount must be greater than 0"),
  description: z.string().max(100, "Description too long").optional(),
  payerMemberId: z.string().or(z.number()), // The ID from chapter_members table
  involvedMemberIds: z.array(z.string().or(z.number())).min(1, "Select at least one person to split with")
});

async function addExpense(req, res) {
  try {
    // 1. Validate Input
    const result = addExpenseSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    }

    const { chapterId, amount, description, payerMemberId, involvedMemberIds } = result.data;
    const userId = req.user.userId;

    // 2. Verify Access (User must be creator of the chapter)
    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) {
      return res.status(403).json({ ok: false, message: "Unauthorized or Chapter not found" });
    }

    // 3. MATH: Calculate Equal Splits
    const count = involvedMemberIds.length;
    const splitAmount = Math.floor((amount / count) * 100) / 100; // Floor to 2 decimals
    let remainder = amount - (splitAmount * count); // Calculate cents left over

    // Fix precision issues (e.g. 0.0099999 -> 0.01)
    remainder = Math.round(remainder * 100) / 100;

    // 4. DATABASE TRANSACTION
    await db.query("BEGIN");

    try {
      // A. Insert Main Expense
      const { rows: expenseRows } = await db.query(
        `INSERT INTO expenses (chapter_id, payer_member_id, amount, description, expense_date)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, created_at`,
        [chapterId, payerMemberId, amount, description || ""]
      );
      const expenseId = expenseRows[0].id;

      // B. Insert Splits
      for (let i = 0; i < count; i++) {
        const memberId = involvedMemberIds[i];

        // Add remainder to the first unlucky person (usually just 1 cent)
        let owes = splitAmount;
        if (i === 0) {
          owes += remainder;
        }

        await db.query(
          `INSERT INTO expense_splits (expense_id, member_id, amount_owed)
           VALUES ($1, $2, $3)`,
          [expenseId, memberId, owes]
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


// Get Expenses for a Chapter (Simple List)
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


// Delete Expense
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


// 1. UPDATE: New Summary Logic using CTEs (Common Table Expressions)
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


// 2. NEW: Get Single Expense Details (for Editing)
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


// 3. NEW: Update Expense
async function updateExpense(req, res) {
  try {
    const { id } = req.params; 
    // We expect: amount, description, payerMemberId, involvedMemberIds
    const { amount, description, payerMemberId, involvedMemberIds } = req.body;
    const userId = req.user.userId;

    // Verify access
    const { rows: check } = await db.query(
      `SELECT e.id, e.chapter_id FROM expenses e 
       JOIN chapters c ON e.chapter_id = c.id
       WHERE e.id = $1 AND c.created_by = $2`, 
      [id, userId]
    );
    if (check.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized" });

    // Calculate Splits (Same logic as addExpense)
    const count = involvedMemberIds.length;
    const splitAmount = Math.floor((amount / count) * 100) / 100;
    let remainder = amount - (splitAmount * count);
    remainder = Math.round(remainder * 100) / 100;

    await db.query("BEGIN");

    try {
      // Update Main Expense
      await db.query(
        `UPDATE expenses 
         SET amount = $1, description = $2, payer_member_id = $3 
         WHERE id = $4`,
        [amount, description, payerMemberId, id]
      );

      // Delete Old Splits
      await db.query("DELETE FROM expense_splits WHERE expense_id = $1", [id]);

      // Insert New Splits
      for (let i = 0; i < count; i++) {
        const memberId = involvedMemberIds[i];
        let owes = splitAmount;
        if (i === 0) owes += remainder;

        await db.query(
          `INSERT INTO expense_splits (expense_id, member_id, amount_owed)
           VALUES ($1, $2, $3)`,
          [id, memberId, owes]
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


// Exports
module.exports = {
  addExpense,
  getChapterExpenses,
  deleteExpense,
  getExpenseSummary, // Updated
  getExpenseDetails, // New
  updateExpense      // New
};
