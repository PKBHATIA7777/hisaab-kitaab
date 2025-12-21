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
    // In future, if you allow members to add expenses, you'd check chapter_members link here.
    // For now, consistent with your "Admin" flow, we check if user created the chapter.
    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) {
      return res.status(403).json({ ok: false, message: "Unauthorized or Chapter not found" });
    }

    // 3. MATH: Calculate Equal Splits
    // We do this on backend to prevent floating point errors from frontend
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

// ✅ NEW: Calculate Total Spent by Each Member
async function getExpenseSummary(req, res) {
  try {
    const { chapterId } = req.params;
    const userId = req.user.userId;

    // 1. Verify Access
    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized" });

    // 2. Aggregation Query
    // We LEFT JOIN members to ensure even people who spent 0 show up
    const { rows } = await db.query(
      `SELECT 
         cm.id as member_id, 
         cm.member_name, 
         COALESCE(SUM(e.amount), 0) as total_spent
       FROM chapter_members cm
       LEFT JOIN expenses e ON cm.id = e.payer_member_id
       WHERE cm.chapter_id = $1
       GROUP BY cm.id, cm.member_name
       ORDER BY total_spent DESC`,
      [chapterId]
    );

    // 3. Calculate Grand Total
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

module.exports = {
  addExpense,
  getChapterExpenses,
  deleteExpense,
  getExpenseSummary // <--- Export this
};
