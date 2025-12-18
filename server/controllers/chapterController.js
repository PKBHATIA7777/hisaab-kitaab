const db = require("../config/db");
const { z } = require("zod");

// Validation Schema
const createChapterSchema = z.object({
  name: z.string().min(1, "Chapter name is required").trim(),
  description: z.string().max(50, "Description cannot exceed 50 characters").optional().or(z.literal("")),
  members: z.array(z.string().min(1)).min(1, "At least one member is required"),
});

// 1. Create a new Chapter
async function createChapter(req, res) {
  try {
    const result = createChapterSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    }

    const { name, description, members } = result.data;
    const userId = req.user.userId;

    // Start Transaction (So if members fail, chapter isn't created)
    await db.query("BEGIN");

    try {
      // Insert Chapter
      const { rows: chapterRows } = await db.query(
        `INSERT INTO chapters (name, description, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, description || "", userId]
      );
      const chapter = chapterRows[0];

      // Insert Members
      for (const memberName of members) {
        await db.query(
          `INSERT INTO chapter_members (chapter_id, member_name)
           VALUES ($1, $2)`,
          [chapter.id, memberName]
        );
      }

      await db.query("COMMIT");

      return res.json({
        ok: true,
        message: "Chapter created successfully",
        chapter,
      });

    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }

  } catch (err) {
    console.error("createChapter error:", err);
    return res.status(500).json({ ok: false, message: "Failed to create chapter" });
  }
}

// 2. Get All Chapters for Dashboard
async function getMyChapters(req, res) {
  try {
    const userId = req.user.userId;

    const { rows } = await db.query(
      `SELECT * FROM chapters 
       WHERE created_by = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({ ok: true, chapters: rows });
  } catch (err) {
    console.error("getMyChapters error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

// 3. Get Single Chapter Details (for later usage)
async function getChapterDetails(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Fetch chapter
    const { rows: chapterRows } = await db.query(
      `SELECT * FROM chapters WHERE id = $1 AND created_by = $2`,
      [id, userId]
    );

    if (chapterRows.length === 0) {
      return res.status(404).json({ ok: false, message: "Chapter not found" });
    }

    // Fetch members
    const { rows: memberRows } = await db.query(
      `SELECT * FROM chapter_members WHERE chapter_id = $1`,
      [id]
    );

    return res.json({
      ok: true,
      chapter: chapterRows[0],
      members: memberRows,
    });
  } catch (err) {
    console.error("getChapterDetails error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

module.exports = {
  createChapter,
  getMyChapters,
  getChapterDetails
};