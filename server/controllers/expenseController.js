/* server/controllers/expenseController.js */
/* MODIFIED: Added net settlements (Feature 1), category support (Feature 4), bulk event assign (Feature 5) */
/* ALL EXISTING FUNCTIONS ARE UNCHANGED — only additions at the bottom + small modifications noted */

const db = require("../config/db");
const { z } = require("zod");
const xss = require("xss");

// --- VALIDATION SCHEMA (Updated: added categoryId) ---
const addExpenseSchema = z.object({
  chapterId: z.string().or(z.number()),
  eventId: z.string().or(z.number()).nullish(),
  amount: z.number().positive("Amount must be greater than 0"),
  description: z.string().max(100, "Description too long").optional(),
  payerMemberId: z.string().or(z.number()),
  categoryId: z.number().int().nullish(), // ✅ NEW: Feature 4
  involvedMemberIds: z.array(z.string().or(z.number())).optional(),
  customSplits: z.array(z.object({
    memberId: z.string().or(z.number()),
    amount: z.number().positive()
  })).optional()
}).refine(data => data.involvedMemberIds || data.customSplits, {
  message: "Either involvedMemberIds or customSplits must be provided"
});

// ─────────────────────────────────────────────────────────────
// EXISTING: addExpense — MODIFIED to include categoryId
// ─────────────────────────────────────────────────────────────
async function addExpense(req, res) {
  try {
    const result = addExpenseSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    }

    const { chapterId, eventId, amount, payerMemberId, involvedMemberIds, customSplits, categoryId } = result.data;
    const description = xss(result.data.description || "");
    const userId = req.user.userId;

    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) {
      return res.status(403).json({ ok: false, message: "Unauthorized or Chapter not found" });
    }

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
        return res.status(400).json({ ok: false, message: `Splits sum does not match Total` });
      }
    } else {
      const count = involvedMemberIds.length;
      if (count === 0) return res.status(400).json({ ok: false, message: "No members involved" });
      const sortedIds = [...involvedMemberIds].map(Number).sort((a, b) => a - b);
      const baseShareCents = Math.floor(totalCents / count);
      let remainderCents = totalCents % count;
      sortedIds.forEach(mId => {
        const myShareCents = baseShareCents + (remainderCents-- > 0 ? 1 : 0);
        finalSplits.push({ memberId: mId, amount: myShareCents / 100 });
      });
    }

    const client = await db.pool.connect();
    await client.query("BEGIN");

    try {
      // ✅ MODIFIED: Added category_id to INSERT
      const { rows: expenseRows } = await client.query(
        `INSERT INTO expenses (chapter_id, event_id, payer_member_id, amount, description, expense_date, category_id)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)
         RETURNING id, created_at`,
        [chapterId, eventId || null, payerMemberId, amount, description, categoryId || null]
      );
      const expenseId = expenseRows[0].id;

      for (const split of finalSplits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, member_id, amount_owed) VALUES ($1, $2, $3)`,
          [expenseId, split.memberId, split.amount]
        );
      }

      await client.query("COMMIT");
      res.json({ ok: true, message: "Expense added", expense: { id: expenseId, eventId: eventId || null, amount, description, date: expenseRows[0].created_at } });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("addExpense error:", err);
    res.status(500).json({ ok: false, message: "Failed to add expense" });
  }
}

// ─────────────────────────────────────────────────────────────
// EXISTING: getChapterExpenses — MODIFIED to return category info
// ─────────────────────────────────────────────────────────────
async function getChapterExpenses(req, res) {
  try {
    const { chapterId } = req.params;
    const { eventId } = req.query;
    const userId = req.user.userId;

    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized" });

    let queryText = `
       SELECT e.id, e.amount, e.description, e.expense_date, e.event_id,
              e.category_id, e.is_synced_from_chapter, e.source_chapter_id,
              e.sync_dismissed,
              cm.member_name as payer_name,
              COALESCE(ec.name, 'Other') AS category_name,
              COALESCE(ec.color, '#C9C9C9') AS category_color,
              COALESCE(ec.icon, '📦') AS category_icon,
              sc.name AS source_chapter_name
       FROM expenses e
       JOIN chapter_members cm ON e.payer_member_id = cm.id
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       LEFT JOIN chapters sc ON e.source_chapter_id = sc.id
       WHERE e.chapter_id = $1
    `;
    const params = [chapterId];

    if (eventId) {
      queryText += ` AND e.event_id = $2`;
      params.push(eventId);
    }

    queryText += ` ORDER BY e.expense_date DESC`;

    const { rows } = await db.query(queryText, params);
    res.json({ ok: true, expenses: rows });
  } catch (err) {
    console.error("getExpenses error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// EXISTING: deleteExpense — UNCHANGED
// ─────────────────────────────────────────────────────────────
async function deleteExpense(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

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

// ─────────────────────────────────────────────────────────────
// EXISTING: getExpenseSummary — UNCHANGED
// ─────────────────────────────────────────────────────────────
async function getExpenseSummary(req, res) {
  try {
    const { chapterId } = req.params;
    const { eventId } = req.query;
    const userId = req.user.userId;

    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized" });

    const queryText = `
      WITH spent_cte AS (
        SELECT payer_member_id, SUM(amount) as total
        FROM expenses
        WHERE chapter_id = $1 AND ($2::int IS NULL OR event_id = $2::int)
        GROUP BY payer_member_id
      ),
      used_cte AS (
        SELECT es.member_id, SUM(es.amount_owed) as total
        FROM expense_splits es
        JOIN expenses e ON es.expense_id = e.id
        WHERE e.chapter_id = $1 AND ($2::int IS NULL OR e.event_id = $2::int)
        GROUP BY es.member_id
      )
      SELECT
        cm.id as member_id, cm.member_name, cm.user_id,
        COALESCE(s.total, 0) as total_spent,
        COALESCE(u.total, 0) as total_used
      FROM chapter_members cm
      LEFT JOIN spent_cte s ON cm.id = s.payer_member_id
      LEFT JOIN used_cte u ON cm.id = u.member_id
      WHERE cm.chapter_id = $1
      ORDER BY total_spent DESC, total_used DESC
    `;

    const { rows } = await db.query(queryText, [chapterId, eventId || null]);
    const grandTotal = rows.reduce((acc, row) => acc + parseFloat(row.total_spent), 0);

    res.json({ ok: true, summary: rows, grandTotal: grandTotal.toFixed(2) });
  } catch (err) {
    console.error("getSummary error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// EXISTING: getExpenseDetails — MODIFIED to return categoryId
// ─────────────────────────────────────────────────────────────
async function getExpenseDetails(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const { rows: expenseRows } = await db.query(
      `SELECT e.* FROM expenses e
       JOIN chapters c ON e.chapter_id = c.id
       WHERE e.id = $1 AND c.created_by = $2`,
      [id, userId]
    );
    if (expenseRows.length === 0) return res.status(404).json({ ok: false, message: "Not found" });

    const { rows: splitRows } = await db.query(
      "SELECT member_id FROM expense_splits WHERE expense_id = $1",
      [id]
    );

    res.json({ ok: true, expense: expenseRows[0], involvedMemberIds: splitRows.map(s => s.member_id) });
  } catch (err) {
    console.error("getDetails error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// EXISTING: updateExpense — MODIFIED to include categoryId
// ─────────────────────────────────────────────────────────────
async function updateExpense(req, res) {
  try {
    const { id } = req.params;
    const result = addExpenseSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    }

    const { chapterId, eventId, amount, payerMemberId, involvedMemberIds, customSplits, categoryId } = result.data;
    const description = xss(result.data.description || "");
    const userId = req.user.userId;

    const { rows: check } = await db.query(
      `SELECT e.id, e.chapter_id FROM expenses e
       JOIN chapters c ON e.chapter_id = c.id
       WHERE e.id = $1 AND c.created_by = $2`,
      [id, userId]
    );
    if (check.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized" });

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
        return res.status(400).json({ ok: false, message: `Splits sum does not match Total` });
      }
    } else {
      const count = involvedMemberIds.length;
      if (count === 0) return res.status(400).json({ ok: false, message: "No members involved" });
      const sortedIds = [...involvedMemberIds].map(Number).sort((a, b) => a - b);
      const baseShareCents = Math.floor(totalCents / count);
      let remainderCents = totalCents % count;
      sortedIds.forEach(mId => {
        const myShareCents = baseShareCents + (remainderCents-- > 0 ? 1 : 0);
        finalSplits.push({ memberId: mId, amount: myShareCents / 100 });
      });
    }

    const client = await db.pool.connect();
    await client.query("BEGIN");

    try {
      // ✅ MODIFIED: Added category_id to UPDATE
      await client.query(
        `UPDATE expenses
         SET amount = $1, description = $2, payer_member_id = $3,
             chapter_id = $4, event_id = $5, category_id = $6,
             sync_dismissed = FALSE
         WHERE id = $7`,
        [amount, description, payerMemberId, chapterId, eventId || null, categoryId || null, id]
      );

      await client.query("DELETE FROM expense_splits WHERE expense_id = $1", [id]);

      for (const split of finalSplits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, member_id, amount_owed) VALUES ($1, $2, $3)`,
          [id, split.memberId, split.amount]
        );
      }

      await client.query("COMMIT");
      res.json({ ok: true, message: "Expense updated" });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("updateExpense error:", err);
    res.status(500).json({ ok: false, message: "Update failed" });
  }
}

// ─────────────────────────────────────────────────────────────
// EXISTING: calculateSettlements — COMPLETELY UNCHANGED
// ─────────────────────────────────────────────────────────────
function calculateSettlements(balances) {
  let debtors = [];
  let creditors = [];

  balances.forEach(person => {
    const balanceCents = Math.round(person.balance * 100);
    if (balanceCents < 0) debtors.push({ ...person, balanceCents });
    else if (balanceCents > 0) creditors.push({ ...person, balanceCents });
  });

  debtors.sort((a, b) => a.balanceCents - b.balanceCents);
  creditors.sort((a, b) => b.balanceCents - a.balanceCents);

  const settlements = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    let debtor = debtors[i];
    let creditor = creditors[j];
    let amountCents = Math.min(Math.abs(debtor.balanceCents), creditor.balanceCents);

    settlements.push({
      from: debtor.name,
      to: creditor.name,
      amount: (amountCents / 100).toFixed(2),
      fromId: debtor.id,
      toId: creditor.id
    });

    debtor.balanceCents += amountCents;
    creditor.balanceCents -= amountCents;

    if (Math.abs(debtor.balanceCents) < 1) i++;
    if (Math.abs(creditor.balanceCents) < 1) j++;
  }

  return settlements;
}

// ─────────────────────────────────────────────────────────────
// EXISTING: getChapterSettlements — MODIFIED to subtract settled records (Feature 1)
// ─────────────────────────────────────────────────────────────
async function getChapterSettlements(req, res) {
  try {
    const { chapterId } = req.params;
    const { eventId } = req.query;
    const userId = req.user.userId;

    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized" });

    const queryText = `
      WITH spent_cte AS (
        SELECT payer_member_id, SUM(amount) as total
        FROM expenses
        WHERE chapter_id = $1 AND ($2::int IS NULL OR event_id = $2::int)
        GROUP BY payer_member_id
      ),
      used_cte AS (
        SELECT es.member_id, SUM(es.amount_owed) as total
        FROM expense_splits es
        JOIN expenses e ON es.expense_id = e.id
        WHERE e.chapter_id = $1 AND ($2::int IS NULL OR e.event_id = $2::int)
        GROUP BY es.member_id
      )
      SELECT
        cm.id, cm.member_name,
        COALESCE(s.total, 0) as total_spent,
        COALESCE(u.total, 0) as total_used
      FROM chapter_members cm
      LEFT JOIN spent_cte s ON cm.id = s.payer_member_id
      LEFT JOIN used_cte u ON cm.id = u.member_id
      WHERE cm.chapter_id = $1
    `;

    const { rows } = await db.query(queryText, [chapterId, eventId || null]);

    const memberBalances = rows.map(row => ({
      id: row.id,
      name: row.member_name,
      balance: parseFloat(row.total_spent) - parseFloat(row.total_used)
    }));

    const rawSettlements = calculateSettlements(memberBalances);

    // ✅ NEW: Feature 1 — subtract already-settled records to get pending
    const { getNetSettlements } = require("./settlementRecordController");
    const pendingSettlements = await getNetSettlements(rawSettlements, chapterId, eventId || null);

    res.json({ ok: true, settlements: pendingSettlements, rawSettlements });
  } catch (err) {
    console.error("getChapterSettlements error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// ✅ NEW: Feature 5 — Bulk assign expenses to an event
// ─────────────────────────────────────────────────────────────
async function bulkAssignEvent(req, res) {
  try {
    const userId = req.user.userId;
    const { expenseIds, eventId, chapterId } = req.body;

    if (!Array.isArray(expenseIds) || expenseIds.length === 0) {
      return res.status(400).json({ ok: false, message: "expenseIds array is required" });
    }
    if (!chapterId) {
      return res.status(400).json({ ok: false, message: "chapterId is required" });
    }

    // Verify chapter ownership
    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) {
      return res.status(403).json({ ok: false, message: "Unauthorized" });
    }

    // If eventId provided, verify it belongs to this chapter
    if (eventId) {
      const { rows: ev } = await db.query(
        "SELECT id FROM events WHERE id = $1 AND chapter_id = $2",
        [eventId, chapterId]
      );
      if (ev.length === 0) {
        return res.status(400).json({ ok: false, message: "Event not found in this chapter" });
      }
    }

    // Verify all expenseIds belong to this chapter
    const { rows: validExpenses } = await db.query(
      `SELECT id FROM expenses WHERE id = ANY($1) AND chapter_id = $2`,
      [expenseIds, chapterId]
    );
    if (validExpenses.length !== expenseIds.length) {
      return res.status(400).json({ ok: false, message: "Some expenses do not belong to this chapter" });
    }

    // Perform bulk update
    await db.query(
      `UPDATE expenses SET event_id = $1 WHERE id = ANY($2) AND chapter_id = $3`,
      [eventId || null, expenseIds, chapterId]
    );

    const action = eventId ? "assigned to event" : "removed from event";
    res.json({ ok: true, message: `${expenseIds.length} expense(s) ${action}` });
  } catch (err) {
    console.error("bulkAssignEvent error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

module.exports = {
  addExpense,
  getChapterExpenses,
  deleteExpense,
  getExpenseSummary,
  getExpenseDetails,
  updateExpense,
  getChapterSettlements,
  calculateSettlements,
  bulkAssignEvent,      // ✅ NEW
};