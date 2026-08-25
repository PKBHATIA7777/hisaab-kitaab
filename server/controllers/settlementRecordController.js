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
}).refine(data => data.fromMemberId !== data.toMemberId, { message: "Cannot settle with yourself" });

// ─────────────────────────────────────────────────────────────
// POST /api/chapters/:chapterId/settlements/mark
// Mark a settlement as paid in real world
// ─────────────────────────────────────────────────────────────
async function markSettlement(req, res) {
  try {
    const { chapterId } = req.params;
    const userId = req.user.userId;

    // Access is already verified by chapterAccessMiddleware

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

    const isCollab = req.chapter.is_collaborative;
    const confirmationStatus = isCollab ? 'pending_confirmation' : 'auto_confirmed';

    // Insert the settlement record
    const { rows } = await db.query(
      `INSERT INTO settlement_records
         (chapter_id, event_id, from_member_id, to_member_id, amount, marked_by, note, status, confirmation_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'settled', $8)
       RETURNING *`,
      [chapterId, eventId || null, fromMemberId, toMemberId, amount, userId, note || "", confirmationStatus]
    );

    if (isCollab) {
      // Find the user_id of the receiver to send a notification
      const { rows: receiverRows } = await db.query("SELECT user_id FROM chapter_members WHERE id = $1", [toMemberId]);
      if (receiverRows.length > 0 && receiverRows[0].user_id) {
        // Prevent duplicate spam (1 min window)
        const { rowCount: recentCount } = await db.query(
          `SELECT 1 FROM notifications 
           WHERE user_id = $1 AND type = 'settlement_marked' AND chapter_id = $2 
           AND created_at > NOW() - INTERVAL '1 minute'`,
          [receiverRows[0].user_id, chapterId]
        );
        
        if (recentCount === 0) {
          await db.query(
            `INSERT INTO notifications (user_id, type, title, body, chapter_id, related_entity_id)
             VALUES ($1, 'settlement_marked', 'Payment Sent', 'Someone marked a payment to you as settled. Please confirm receipt.', $2, $3)`,
            [receiverRows[0].user_id, chapterId, rows[0].id]
          );
        }
      }
    }

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

    // Access is already verified by chapterAccessMiddleware

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

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

    queryText += ` ORDER BY sr.marked_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await db.query(queryText, params);

    let countQuery = `SELECT COUNT(*) FROM settlement_records WHERE chapter_id = $1 AND status = 'settled'`;
    const countParams = [chapterId];
    if (eventId) {
      countQuery += ` AND event_id = $2`;
      countParams.push(eventId);
    }
    const { rows: countRows } = await db.query(countQuery, countParams);
    const totalCount = parseInt(countRows[0].count, 10);

    res.json({
      ok: true,
      history: rows,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount
      }
    });
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

    // Access is already verified by chapterAccessMiddleware

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
    SELECT from_member_id, to_member_id, confirmation_status, SUM(amount) as amount
    FROM settlement_records
    WHERE chapter_id = $1 AND status = 'settled'
  `;
  const params = [chapterId];
  if (eventId) {
    query += ` AND event_id = $2`;
    params.push(eventId);
  }
  query += ` GROUP BY from_member_id, to_member_id, confirmation_status`;

  const { rows: settled } = await db.query(query, params);

  const confirmedMap = {};
  const pendingMap = {};

  settled.forEach(s => {
    const key = `${s.from_member_id}-${s.to_member_id}`;
    const amountCents = Math.round(parseFloat(s.amount) * 100);
    if (s.confirmation_status === 'confirmed' || s.confirmation_status === 'auto_confirmed') {
      confirmedMap[key] = (confirmedMap[key] || 0) + amountCents;
    } else if (s.confirmation_status === 'pending_confirmation') {
      pendingMap[key] = (pendingMap[key] || 0) + amountCents;
    }
  });

  // Subtract settled amounts from raw settlements
  const pending = [];
  rawSettlements.forEach(s => {
    const key = `${s.fromId}-${s.toId}`;
    const alreadySettledCents = confirmedMap[key] || 0;
    const pendingConfirmationCents = pendingMap[key] || 0;
    
    const amountCents = Math.round(parseFloat(s.amount) * 100);
    const remainingCents = amountCents - alreadySettledCents;

    if (remainingCents > 1) { // more than 1 cent
      pending.push({ 
        ...s, 
        amount: (remainingCents / 100).toFixed(2),
        pendingConfirmationAmount: (pendingConfirmationCents / 100).toFixed(2)
      });
    }
  });

  return pending;
}

// ─────────────────────────────────────────────────────────────
// NEW: Confirm Settlement (Receiver or Admin)
// POST /api/chapters/:chapterId/settlements/:recordId/confirm
// ─────────────────────────────────────────────────────────────
async function confirmSettlement(req, res) {
  try {
    const { chapterId, recordId } = req.params;
    const userId = req.user.userId;
    const member = req.chapterMember; // Hydrated by middleware

    const { rows: recordRows } = await db.query(
      `SELECT sr.id, sr.to_member_id, sr.confirmation_status 
       FROM settlement_records sr
       WHERE sr.id = $1 AND sr.chapter_id = $2`,
      [recordId, chapterId]
    );

    if (recordRows.length === 0) {
      return res.status(404).json({ ok: false, message: "Settlement record not found" });
    }

    const record = recordRows[0];

    // Authorization: Must be the receiver or an admin
    if (record.to_member_id !== member.id && member.role !== 'admin') {
      return res.status(403).json({ ok: false, message: "Only the receiver or an admin can confirm this settlement" });
    }

    if (record.confirmation_status === 'confirmed') {
      return res.status(400).json({ ok: false, message: "Settlement is already confirmed" });
    }

    await db.query(
      "UPDATE settlement_records SET confirmation_status = 'confirmed', confirmed_by = $1, confirmed_at = NOW() WHERE id = $2",
      [userId, recordId]
    );

    res.json({ ok: true, message: "Settlement confirmed successfully" });
  } catch (err) {
    log.error({ err }, "confirmSettlement error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// NEW: Dispute Settlement
// POST /api/chapters/:chapterId/settlements/:recordId/dispute
// ─────────────────────────────────────────────────────────────
async function disputeSettlement(req, res) {
  try {
    const { chapterId, recordId } = req.params;
    const userId = req.user.userId;
    const member = req.chapterMember; // Hydrated by middleware

    const { rows: recordRows } = await db.query(
      `SELECT sr.id, sr.to_member_id, sr.confirmation_status 
       FROM settlement_records sr
       WHERE sr.id = $1 AND sr.chapter_id = $2`,
      [recordId, chapterId]
    );

    if (recordRows.length === 0) {
      return res.status(404).json({ ok: false, message: "Settlement record not found" });
    }

    const record = recordRows[0];

    // Authorization: Must be the receiver or an admin
    if (record.to_member_id !== member.id && member.role !== 'admin') {
      return res.status(403).json({ ok: false, message: "Only the receiver or an admin can dispute this settlement" });
    }

    if (record.confirmation_status === 'confirmed' || record.confirmation_status === 'auto_confirmed') {
      return res.status(400).json({ ok: false, message: "Settlement is already confirmed and cannot be disputed" });
    }

    if (record.confirmation_status === 'disputed') {
      return res.status(400).json({ ok: false, message: "Settlement is already disputed" });
    }

    await db.query(
      "UPDATE settlement_records SET confirmation_status = 'disputed', confirmed_by = $1, confirmed_at = NOW() WHERE id = $2",
      [userId, recordId]
    );

    res.json({ ok: true, message: "Settlement disputed successfully" });
  } catch (err) {
    log.error({ err }, "disputeSettlement error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

module.exports = {
  markSettlement,
  getSettlementHistory,
  undoSettlement,
  confirmSettlement,
  disputeSettlement,
  getNetSettlements,
};