/* server/controllers/chapterController.js */
const db = require("../config/db");
const { z } = require("zod");
const xss = require("xss");

// --- VALIDATION SCHEMAS ---

// Updated: Members is now an array of objects { name, friendId }
const createChapterSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(50).optional().or(z.literal("")),
  members: z.array(
    z.object({
      name: z.string().min(1).max(50).trim(),
      friendId: z.number().int().nullish() // Optional ID if picking from friends list
    })
  ).min(1),
});

const addMemberSchema = z.object({
  memberName: z.string().min(1, "Name is required").max(50, "Name too long").trim(),
  friendId: z.number().int().nullish() // Optional: Link to friend
});

// =========================================
// 1. Create Chapter (FIX B4: Duplicate Prevention)
// =========================================
async function createChapter(req, res) {
  try {
    const result = createChapterSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ ok: false, message: result.error.issues[0].message });

    const name = xss(result.data.name);
    const description = xss(result.data.description || "");
    const rawMembers = result.data.members; // Now an array of objects
    
    const userId = req.user.userId;

    // 1. Fetch Creator Name
    const { rows: userRows } = await db.query("SELECT real_name FROM users WHERE id = $1", [userId]);
    const creatorName = userRows[0]?.real_name || "Admin";

    // 2. Normalize & Deduplicate Members Input
    const uniqueMembers = new Set();
    const cleanMembers = [];
    
    // Add Creator to 'seen' set to avoid adding them twice
    uniqueMembers.add(creatorName.toLowerCase());

    for (const m of rawMembers) {
        const cleanName = xss(m.name).trim();
        const lower = cleanName.toLowerCase();
        
        // Deduplicate based on Name (case-insensitive)
        if (!uniqueMembers.has(lower) && lower.length > 0) {
            uniqueMembers.add(lower);
            // Push object with cleaned name and friendId
            cleanMembers.push({ 
              name: cleanName, 
              friendId: m.friendId || null 
            });
        }
    }

    // 3. Check Duplicate Chapter Name
    const { rows: existing } = await db.query(
      "SELECT id FROM chapters WHERE name = $1 AND created_by = $2",
      [name, userId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ ok: false, message: "You already have a chapter with this name." });
    }

    await db.query("BEGIN");

    try {
      // 4. Insert Chapter
      const { rows: chapterRows } = await db.query(
        `INSERT INTO chapters (name, description, created_by) VALUES ($1, $2, $3) RETURNING *`,
        [name, description, userId]
      );
      const chapter = chapterRows[0];

      // 5. Insert Creator
      await db.query(
        `INSERT INTO chapter_members (chapter_id, member_name, user_id) VALUES ($1, $2, $3)`,
        [chapter.id, creatorName, userId]
      );

      // 6. Insert Deduplicated Members (With friend_id if available)
      for (const m of cleanMembers) {
        await db.query(
          `INSERT INTO chapter_members (chapter_id, member_name, friend_id) VALUES ($1, $2, $3)`,
          [chapter.id, m.name, m.friendId]
        );
      }

      await db.query("COMMIT");
      res.json({ ok: true, message: "Chapter created", chapter });
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error("createChapter error:", err);
    res.status(500).json({ ok: false, message: "Failed to create chapter" });
  }
}

// =========================================
// 2. Add Single Member
// =========================================
async function addMember(req, res) {
  try {
    const { id } = req.params; // Chapter ID
    const userId = req.user.userId;
    const result = addMemberSchema.safeParse(req.body);

    if (!result.success) return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    
    const memberName = xss(result.data.memberName);
    const friendId = result.data.friendId || null;

    // Verify Ownership
    const { rows: chap } = await db.query("SELECT id FROM chapters WHERE id = $1 AND created_by = $2", [id, userId]);
    if (chap.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized or Chapter not found" });

    // Check duplicate name in this chapter
    const { rows: dup } = await db.query(
      "SELECT id FROM chapter_members WHERE chapter_id = $1 AND LOWER(member_name) = LOWER($2)",
      [id, memberName]
    );
    if (dup.length > 0) return res.status(400).json({ ok: false, message: "Member already exists" });

    // Insert (Now including friend_id)
    const { rows: newMember } = await db.query(
      `INSERT INTO chapter_members (chapter_id, member_name, friend_id) VALUES ($1, $2, $3) RETURNING *`,
      [id, memberName, friendId]
    );

    res.json({ ok: true, message: "Member added", member: newMember[0] });
  } catch (err) {
    console.error("addMember error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// =========================================
// 3. Delete Member
// =========================================
async function deleteMember(req, res) {
  try {
    const { id, memberId } = req.params; // id=chapterId, memberId=memberId
    const userId = req.user.userId;

    // Verify Ownership of Chapter
    const { rows: chap } = await db.query("SELECT id FROM chapters WHERE id = $1 AND created_by = $2", [id, userId]);
    if (chap.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized" });

    // Prevent deleting the Admin (the one with user_id matching creator)
    const { rows: member } = await db.query("SELECT user_id FROM chapter_members WHERE id = $1", [memberId]);
    if (member.length > 0 && member[0].user_id === userId) {
      return res.status(400).json({ ok: false, message: "Cannot remove the chapter admin" });
    }

    // Delete
    await db.query("DELETE FROM chapter_members WHERE id = $1 AND chapter_id = $2", [memberId, id]);

    res.json({ ok: true, message: "Member removed" });
  } catch (err) {
    console.error("deleteMember error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// =========================================
// 4. Get All Chapters for Dashboard (Optimized)
// =========================================
async function getMyChapters(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.description, c.created_at, COUNT(cm.id) as member_count
       FROM chapters c LEFT JOIN chapter_members cm ON c.id = cm.chapter_id
       WHERE c.created_by = $1 GROUP BY c.id ORDER BY c.created_at DESC`,
      [req.user.userId]
    );
    res.json({ ok: true, chapters: rows });
  } catch (err) { 
    console.error("getMyChapters error:", err);
    res.status(500).json({ ok: false, message: "Server error" }); 
  }
}

// =========================================
// 5. Get Single Chapter Details
// =========================================
async function getChapterDetails(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { rows: chapterRows } = await db.query(`SELECT * FROM chapters WHERE id = $1 AND created_by = $2`, [id, userId]);
    if (chapterRows.length === 0) return res.status(404).json({ ok: false, message: "Chapter not found" });

    // Fetch members with user_id so frontend knows who is Admin
    const { rows: memberRows } = await db.query(`SELECT * FROM chapter_members WHERE chapter_id = $1 ORDER BY id ASC`, [id]);
    
    res.json({ ok: true, chapter: chapterRows[0], members: memberRows });
  } catch (err) { 
    console.error("getChapterDetails error:", err);
    res.status(500).json({ ok: false, message: "Server error" }); 
  }
}

// =========================================
// 6. Update Chapter
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

    const sanitizedName = xss(name.trim());
    const sanitizedDescription = xss(description || "");

    const { rowCount } = await db.query(
      `UPDATE chapters SET name = $1, description = $2 WHERE id = $3 AND created_by = $4`,
      [sanitizedName, sanitizedDescription, id, userId]
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
// 7. Delete Chapter
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
  deleteChapter,
  addMember,
  deleteMember
};