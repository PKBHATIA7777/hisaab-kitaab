const db = require("../config/db");
const log = require("../utils/logger");

// ─────────────────────────────────────────────────────────────
// 1. Get Notifications
// GET /api/notifications
// ─────────────────────────────────────────────────────────────
async function getNotifications(req, res) {
  try {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const { rows } = await db.query(
      `SELECT n.id, n.type, n.title, n.body, n.is_read, n.created_at, n.chapter_id, n.related_entity_id, c.name AS chapter_name
       FROM notifications n
       LEFT JOIN chapters c ON n.chapter_id = c.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1`,
      [userId]
    );
    const totalCount = parseInt(countRows[0].count, 10);

    res.json({
      ok: true,
      notifications: rows,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount
      }
    });
  } catch (err) {
    log.error({ err }, "getNotifications error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Get Unread Count (For Polling)
// GET /api/notifications/unread-count
// ─────────────────────────────────────────────────────────────
async function getUnreadCount(req, res) {
  try {
    const userId = req.user.userId;

    const { rows } = await db.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    res.json({ ok: true, count: parseInt(rows[0].count, 10) });
  } catch (err) {
    log.error({ err }, "getUnreadCount error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Mark Notification as Read
// PATCH /api/notifications/:id/read
// ─────────────────────────────────────────────────────────────
async function markAsRead(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const { rowCount } = await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: "Notification not found" });
    }

    res.json({ ok: true, message: "Marked as read" });
  } catch (err) {
    log.error({ err }, "markAsRead error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Mark All as Read
// PATCH /api/notifications/read-all
// ─────────────────────────────────────────────────────────────
async function markAllAsRead(req, res) {
  try {
    const userId = req.user.userId;

    await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    res.json({ ok: true, message: "All marked as read" });
  } catch (err) {
    log.error({ err }, "markAllAsRead error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
};
