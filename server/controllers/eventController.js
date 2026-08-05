/* server/controllers/eventController.js */
const db = require("../config/db");
const { z } = require("zod");
const xss = require("xss");
const log = require("../utils/logger");

const createEventSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).trim(),
});

// 1. Create Event
async function createEvent(req, res) {
  try {
    const { chapterId } = req.params;
    const userId = req.user.userId;
    const result = createEventSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    }

    const name = xss(result.data.name);

    // Access is already verified by chapterAccessMiddleware
    // req.chapter and req.chapterMember are available if needed

    const { rows } = await db.query(
      `INSERT INTO events (chapter_id, name) VALUES ($1, $2) RETURNING *`,
      [chapterId, name]
    );

    res.json({ ok: true, message: "Event created", event: rows[0] });
  } catch (err) {
    log.error({ err }, "createEvent error");
    res.status(500).json({ ok: false, message: "Failed to create event" });
  }
}

// 2. Get All Events for a Chapter
async function getChapterEvents(req, res) {
  try {
    const { chapterId } = req.params;
    const userId = req.user.userId;

    // Access is already verified by chapterAccessMiddleware

    const { rows } = await db.query(
      `SELECT * FROM events WHERE chapter_id = $1 AND status = 'active' ORDER BY created_at DESC`,
      [chapterId]
    );

    res.json({ ok: true, events: rows });
  } catch (err) {
    log.error({ err }, "getChapterEvents error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

module.exports = {
  createEvent,
  getChapterEvents
};