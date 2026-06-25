/* server/controllers/settlementRecordController.js */
/* Feature 1: Mark settlements as settled/received */

const db = require("../config/db");
const log = require("../utils/logger");
const { z } = require("zod");

const markSchema = z.object({
  fromMemberId: z.number().int().positive(),
  toMemberId: z.number().int().positive(),
  amount: z.number().positive(),
  note: z.string().max(200).optional().or(z.literal("")),
  eventId: z.number().int().nullish(),
});

// ─────────────────────────────────────────────────────────────
// POST /api/chapters/:chapterId/settlements/mark
// Mark a settlement as paid in real world
// ─────────────────────────────────────────────────────────────
async function markSettlement(req, res) {
  try {
    const { chapterId } = req.params;
    const userId = req.user.userId;

    // Verify chapter access
    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) {
      return res.status(403).json({ ok: false, message: "Unauthorized or chapter not found" });
    }

    const result = markSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    }

    const { fromMemberId, toMemberId, amount, note, eventId } = result.data;

    // Verify both members belong to this chapter
    const { rows: members } = await db.query(
      `SELECT id FROM chapter_members WHERE id = ANY($1) AND chapter_id = $2`,
      [[fromMemberId, toMemberId], chapterId]
    );
    if (members.length < 2) {
      return res.status(400).json({ ok: false, message: "Invalid member IDs for this chapter" });
    }

    // Insert the settlement record
    const { rows } = await db.query(
      `INSERT INTO settlement_records
         (chapter_id, event_id, from_member_id, to_member_id, amount, marked_by, note, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'settled')
       RETURNING *`,
      [chapterId, eventId || null, fromMemberId, toMemberId, amount, userId, note || ""]
    );

    res.json({ ok: true, message: "Settlement marked as completed", record: rows[0] });
  } catch (err) {
    log.error({ err }, "markSettlement error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/chapters/:chapterId/settlements/history
// Get all settlement records (completed payments)
// ─────────────────────────────────────────────────────────────
async function getSettlementHistory(req, res) {
  try {
    const { chapterId } = req.params;
    const { eventId } = req.query;
    const userId = req.user.userId;

    // Verify chapter access
    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) {
      return res.status(403).json({ ok: false, message: "Unauthorized" });
    }

    let queryText = `
      SELECT
        sr.id,
        sr.amount,
        sr.note,
        sr.status,
        sr.marked_at,
        sr.event_id,
        fm.member_name AS from_name,
        tm.member_name AS to_name,
        sr.from_member_id,
        sr.to_member_id
      FROM settlement_records sr
      JOIN chapter_members fm ON sr.from_member_id = fm.id
      JOIN chapter_members tm ON sr.to_member_id = tm.id
      WHERE sr.chapter_id = $1 AND sr.status = 'settled'
    `;
    const params = [chapterId];

    if (eventId) {
      queryText += ` AND sr.event_id = $2`;
      params.push(eventId);
    }

    queryText += ` ORDER BY sr.marked_at DESC`;

    const { rows } = await db.query(queryText, params);
    res.json({ ok: true, history: rows });
  } catch (err) {
    log.error({ err }, "getSettlementHistory error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/chapters/:chapterId/settlements/history/:recordId
// Undo a settlement record (bring it back to pending)
// ─────────────────────────────────────────────────────────────
async function undoSettlement(req, res) {
  try {
    const { chapterId, recordId } = req.params;
    const userId = req.user.userId;

    // Verify chapter access
    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [chapterId, userId]
    );
    if (chap.length === 0) {
      return res.status(403).json({ ok: false, message: "Unauthorized" });
    }

    const { rowCount } = await db.query(
      "DELETE FROM settlement_records WHERE id = $1 AND chapter_id = $2",
      [recordId, chapterId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: "Record not found" });
    }

    res.json({ ok: true, message: "Settlement undone — moved back to pending" });
  } catch (err) {
    log.error({ err }, "undoSettlement error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// Helper exported for use in expenseController
// Subtracts settled amounts from raw settlements list
// ─────────────────────────────────────────────────────────────
async function getNetSettlements(rawSettlements, chapterId, eventId) {
  // Fetch all settlement records for this chapter/event
  let query = `
    SELECT from_member_id, to_member_id, SUM(amount) as settled_amount
    FROM settlement_records
    WHERE chapter_id = $1 AND status = 'settled'
  `;
  const params = [chapterId];
  if (eventId) {
    query += ` AND event_id = $2`;
    params.push(eventId);
  }
  query += ` GROUP BY from_member_id, to_member_id`;

  const { rows: settled } = await db.query(query, params);

  // Build a map: "fromId-toId" => settledAmount
  const settledMap = {};
  settled.forEach(s => {
    const key = `${s.from_member_id}-${s.to_member_id}`;
    settledMap[key] = parseFloat(s.settled_amount);
  });

  // Subtract settled amounts from raw settlements
  const pending = [];
  rawSettlements.forEach(s => {
    const key = `${s.fromId}-${s.toId}`;
    const alreadySettled = settledMap[key] || 0;
    const remaining = parseFloat(s.amount) - alreadySettled;

    if (remaining > 0.01) {
      pending.push({ ...s, amount: remaining.toFixed(2) });
    }
    // If remaining <= 0.01, it's fully settled — skip it from pending
  });

  return pending;
}

module.exports = {
  markSettlement,
  getSettlementHistory,
  undoSettlement,
  getNetSettlements,
};