/* server/controllers/expenseController.js */
/* MODIFIED: Added net settlements (Feature 1), category support (Feature 4), bulk event assign (Feature 5) */
/* ALL EXISTING FUNCTIONS ARE UNCHANGED — only additions at the bottom + small modifications noted */

const db = require("../config/db");
const log = require("../utils/logger");
const { z } = require("zod");
const xss = require("xss");
const { distributeEqually } = require("../utils/splits");

// --- VALIDATION SCHEMA (Updated: added categoryId, expenseDate) ---
const addExpenseSchema = z.object({
  chapterId: z.string().or(z.number()),
  eventId: z.string().or(z.number()).nullish(),
  amount: z.number().positive("Amount must be greater than 0"),
  description: z.string().max(100, "Description too long").optional(),
  payerMemberId: z.string().or(z.number()),
  categoryId: z.number().int().nullish(), // ✅ NEW: Feature 4
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").nullish(), // ✅ NEW: Step 5 Date Picker
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

    const { chapterId, eventId, amount, payerMemberId, involvedMemberIds, customSplits, categoryId, expenseDate } = result.data;
    const description = xss(result.data.description || "");
    const userId = req.user.userId;

    // Access is verified by chapterAccessMiddleware
    const chapter = req.chapter;
    const chapterMember = req.chapterMember;

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

      const splits = distributeEqually(totalCents, involvedMemberIds);
      splits.forEach(s => finalSplits.push(s));
    }

    const allMemberIds = new Set([payerMemberId]);
    finalSplits.forEach(s => allMemberIds.add(s.memberId));
    const memberIdArray = Array.from(allMemberIds);

    const client = await db.pool.connect();
    await client.query("BEGIN");

    try {
      // ✅ NEW: Verify all member IDs belong strictly to this chapter
      const { rows: memberCheck } = await client.query(
        `SELECT id FROM chapter_members WHERE id = ANY($1) AND chapter_id = $2`,
        [memberIdArray, chapterId]
      );
      if (memberCheck.length !== memberIdArray.length) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(400).json({ ok: false, message: "One or more members do not belong to this chapter" });
      }

      // ✅ MODIFIED: Added category_id, expenseDate, and added_by_user_id to INSERT
      const { rows: expenseRows } = await client.query(
        `INSERT INTO expenses (chapter_id, event_id, payer_member_id, amount, description, expense_date, category_id, added_by_user_id)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamp, NOW()), $7, $8)
         RETURNING id, created_at`,
        [chapterId, eventId || null, payerMemberId, amount, description, expenseDate || null, categoryId || null, userId]
      );
      const expenseId = expenseRows[0].id;

      if (finalSplits.length > 0) {
        const values = finalSplits.map((s, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(", ");
        const params = [expenseId, ...finalSplits.flatMap(s => [s.memberId, s.amount])];
        await client.query(
          `INSERT INTO expense_splits (expense_id, member_id, amount_owed) VALUES ${values}`,
          params
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
    log.error({ err }, "addExpense error");
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

    // Access is verified by chapterAccessMiddleware

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

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    if (eventId) {
      queryText += ` AND e.event_id = $2`;
      params.push(eventId);
    }

    queryText += ` ORDER BY e.expense_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await db.query(queryText, params);

    let countQuery = `SELECT COUNT(*) FROM expenses e WHERE e.chapter_id = $1`;
    const countParams = [chapterId];
    if (eventId) {
      countQuery += ` AND e.event_id = $2`;
      countParams.push(eventId);
    }
    const { rows: countRows } = await db.query(countQuery, countParams);
    const totalCount = parseInt(countRows[0].count, 10);

    res.json({ 
      ok: true, 
      expenses: rows,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount
      }
    });
  } catch (err) {
    log.error({ err }, "getExpenses error");
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
      `SELECT e.id, c.is_collaborative, c.created_by, e.added_by_user_id, cm.role AS member_role 
       FROM expenses e
       JOIN chapters c ON e.chapter_id = c.id
       LEFT JOIN chapter_members cm ON cm.chapter_id = c.id AND cm.user_id = $2 AND cm.status = 'active'
       WHERE e.id = $1`,
      [id, userId]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, message: "Not found" });
    
    const exp = rows[0];
    if (exp.is_collaborative) {
      if (!exp.member_role) return res.status(403).json({ ok: false, message: "Unauthorized" });
      if (exp.member_role !== 'admin' && exp.added_by_user_id !== userId) {
        return res.status(403).json({ ok: false, message: "Only admin or the creator can delete this expense" });
      }
    } else {
      if (exp.created_by !== userId) return res.status(403).json({ ok: false, message: "Unauthorized" });
    }

    await db.query("DELETE FROM expenses WHERE id = $1", [id]);
    res.json({ ok: true, message: "Expense deleted" });
  } catch (err) {
    log.error({ err }, "deleteExpense error");
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

    // Access is verified by chapterAccessMiddleware

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
      WHERE cm.chapter_id = $1 AND cm.status = 'active'
      ORDER BY total_spent DESC, total_used DESC
    `;

    const { rows } = await db.query(queryText, [chapterId, eventId || null]);
    const grandTotal = rows.reduce((acc, row) => acc + parseFloat(row.total_spent), 0);

    res.json({ ok: true, summary: rows, grandTotal: grandTotal.toFixed(2) });
  } catch (err) {
    log.error({ err }, "getSummary error");
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
      `SELECT e.*, c.is_collaborative, c.created_by, cm.role AS member_role 
       FROM expenses e
       JOIN chapters c ON e.chapter_id = c.id
       LEFT JOIN chapter_members cm ON cm.chapter_id = c.id AND cm.user_id = $2 AND cm.status = 'active'
       WHERE e.id = $1`,
      [id, userId]
    );
    if (expenseRows.length === 0) return res.status(404).json({ ok: false, message: "Not found" });
    
    const exp = expenseRows[0];
    if (exp.is_collaborative) {
      if (!exp.member_role) return res.status(403).json({ ok: false, message: "Unauthorized" });
    } else {
      if (exp.created_by !== userId) return res.status(403).json({ ok: false, message: "Unauthorized" });
    }

    const { rows: splitRows } = await db.query(
      "SELECT member_id FROM expense_splits WHERE expense_id = $1",
      [id]
    );

    res.json({ ok: true, expense: expenseRows[0], involvedMemberIds: splitRows.map(s => s.member_id) });
  } catch (err) {
    log.error({ err }, "getDetails error");
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

    const { chapterId, eventId, amount, payerMemberId, involvedMemberIds, customSplits, categoryId, expenseDate } = result.data;
    const description = xss(result.data.description || "");
    const userId = req.user.userId;

    const { rows: check } = await db.query(
      `SELECT e.id, e.chapter_id, c.is_collaborative, c.created_by, e.added_by_user_id, cm.role AS member_role 
       FROM expenses e
       JOIN chapters c ON e.chapter_id = c.id
       LEFT JOIN chapter_members cm ON cm.chapter_id = c.id AND cm.user_id = $2 AND cm.status = 'active'
       WHERE e.id = $1`,
      [id, userId]
    );
    if (check.length === 0) return res.status(404).json({ ok: false, message: "Not found" });
    
    const exp = check[0];
    if (exp.is_collaborative) {
      if (!exp.member_role) return res.status(403).json({ ok: false, message: "Unauthorized" });
      if (exp.member_role !== 'admin' && exp.added_by_user_id !== userId) {
        return res.status(403).json({ ok: false, message: "Only admin or the creator can edit this expense" });
      }
    } else {
      if (exp.created_by !== userId) return res.status(403).json({ ok: false, message: "Unauthorized" });
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

      const splits = distributeEqually(totalCents, involvedMemberIds);
      splits.forEach(s => finalSplits.push(s));
    }

    const allMemberIds = new Set([payerMemberId]);
    finalSplits.forEach(s => allMemberIds.add(s.memberId));
    const memberIdArray = Array.from(allMemberIds);

    const client = await db.pool.connect();
    await client.query("BEGIN");

    try {
      // ✅ NEW: Verify all member IDs belong strictly to this chapter
      const { rows: memberCheck } = await client.query(
        `SELECT id FROM chapter_members WHERE id = ANY($1) AND chapter_id = $2`,
        [memberIdArray, chapterId]
      );
      if (memberCheck.length !== memberIdArray.length) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(400).json({ ok: false, message: "One or more members do not belong to this chapter" });
      }

      // ✅ MODIFIED: Added category_id and expense_date to UPDATE
      await client.query(
        `UPDATE expenses
         SET amount = $1, description = $2, payer_member_id = $3,
             chapter_id = $4, event_id = $5, category_id = $6,
             expense_date = COALESCE($7::timestamp, expense_date),
             sync_dismissed = FALSE
         WHERE id = $8`,
        [amount, description, payerMemberId, chapterId, eventId || null, categoryId || null, expenseDate || null, id]
      );

      await client.query("DELETE FROM expense_splits WHERE expense_id = $1", [id]);

      if (finalSplits.length > 0) {
        const values = finalSplits.map((s, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(", ");
        const params = [id, ...finalSplits.flatMap(s => [s.memberId, s.amount])];
        await client.query(
          `INSERT INTO expense_splits (expense_id, member_id, amount_owed) VALUES ${values}`,
          params
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
    log.error({ err }, "updateExpense error");
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
    const balanceCents = Math.round(parseFloat(person.balance) * 100);
    if (balanceCents < -1) debtors.push({ ...person, id: Number(person.id), balanceCents });
    else if (balanceCents > 1) creditors.push({ ...person, id: Number(person.id), balanceCents });
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
      fromId: Number(debtor.id),
      toId: Number(creditor.id)
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

    // Access is verified by chapterAccessMiddleware

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
    log.error({ err }, "getChapterSettlements error");
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

    // Access is verified by chapterAccessMiddleware

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
    log.error({ err }, "bulkAssignEvent error");
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