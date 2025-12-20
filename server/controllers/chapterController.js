const db = require("../config/db");
const { z } = require("zod");

// =========================================
// 1. UPDATED VALIDATION SCHEMA (Security Fix)
// =========================================
const createChapterSchema = z.object({
  name: z.string()
    .min(1, "Chapter name is required")
    .max(100, "Name too long")
    .regex(/^[^<>]*$/, "HTML tags (< >) are not allowed")
    .trim(),

  description: z.string()
    .max(50, "Description cannot exceed 50 characters")
    .regex(/^[^<>]*$/, "HTML tags (< >) are not allowed")
    .optional()
    .or(z.literal("")),

  members: z.array(
    z.string()
      .min(1)
      .max(50, "Member name too long")
      .regex(/^[^<>]*$/, "HTML tags (< >) are not allowed")
      .trim()
  ).min(1, "At least one member is required"),
});

// =========================================
// 2. Create a new Chapter (✅ DUPLICATE PREVENTION)
// =========================================
async function createChapter(req, res) {
  try {
    // 1. Validate Input
    const result = createChapterSchema.safeParse(req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ ok: false, message: result.error.issues[0].message });
    }

    const { name, description, members } = result.data;
    const userId = req.user.userId;

    // =========================================================
    // ✅ NEW CHECK: Prevent Duplicate Chapter Names
    // =========================================================
    const { rows: existing } = await db.query(
      "SELECT id FROM chapters WHERE name = $1 AND created_by = $2",
      [name, userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        ok: false, 
        message: "You already have a chapter with this name." 
      });
    }
    // =========================================================

    // Start Transaction
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
    return res
      .status(500)
      .json({ ok: false, message: "Failed to create chapter" });
  }
}

// =========================================
// 3. Get All Chapters for Dashboard (Optimized: 1 Query)
// =========================================
async function getMyChapters(req, res) {
  try {
    const userId = req.user.userId;

    // OPTIMIZATION: Fetch chapters AND members in a single query using LEFT JOIN and JSON_AGG
    const { rows } = await db.query(
      `SELECT 
         c.id, 
         c.name, 
         c.description, 
         c.created_at,
         COUNT(cm.id) as member_count
       FROM chapters c
       LEFT JOIN chapter_members cm ON c.id = cm.chapter_id
       WHERE c.created_by = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [userId]
    );

    return res.json({ ok: true, chapters: rows });
  } catch (err) {
    console.error("getMyChapters error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

// =========================================
// 4. Get Single Chapter Details
// =========================================
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

// =========================================
// 5. Update Chapter (Rename)
// =========================================
async function updateChapter(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { name, description } = req.body;

    // Simple validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ ok: false, message: "Name is required" });
    }

    const { rowCount } = await db.query(
      `UPDATE chapters 
       SET name = $1, description = $2 
       WHERE id = $3 AND created_by = $4`,
      [name.trim(), description || "", id, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: "Chapter not found or unauthorized" });
    }

    res.json({ ok: true, message: "Chapter updated" });
  } catch (err) {
    console.error("updateChapter error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// =========================================
// 6. Delete Chapter
// =========================================
async function deleteChapter(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Use a transaction to clean up members first
    await db.query("BEGIN");
    
    // 1. Check ownership
    const { rows } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [id, userId]
    );
    if (rows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ ok: false, message: "Chapter not found" });
    }

    // 2. Delete Members
    await db.query("DELETE FROM chapter_members WHERE chapter_id = $1", [id]);
    
    // 3. Delete Chapter
    await db.query("DELETE FROM chapters WHERE id = $1", [id]);

    await db.query("COMMIT");
    res.json({ ok: true, message: "Chapter deleted successfully" });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("deleteChapter error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

module.exports = {
  createChapter,
  getMyChapters,
  getChapterDetails,
  updateChapter,
  deleteChapter
};
