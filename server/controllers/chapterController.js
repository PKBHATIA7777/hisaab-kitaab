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
  ).min(0), // CHANGE 1: Changed from .min(1) to .min(0) to allow solo chapters
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

    const client = await db.pool.connect();
    await client.query("BEGIN");

    try {
      // 4. Insert Chapter
      const { rows: chapterRows } = await client.query(
        `INSERT INTO chapters (name, description, created_by) VALUES ($1, $2, $3) RETURNING *`,
        [name, description, userId]
      );
      const chapter = chapterRows[0];

      // ✅ PATCH B APPLIED: Insert Creator (skip if explicitly excluded — Feature 2)
      const creatorExcluded = req.body.creatorExcluded === true || req.body.creatorExcluded === 'true';
      if (!creatorExcluded) {
        await client.query(
          `INSERT INTO chapter_members (chapter_id, member_name, user_id) VALUES ($1, $2, $3)`,
          [chapter.id, creatorName, userId]
        );
      }

      // 6. Insert Deduplicated Members (With friend_id if available)
      // CHANGE 2: Loop naturally runs zero times if cleanMembers is empty - no guard needed
      for (const m of cleanMembers) {
        await client.query(
          `INSERT INTO chapter_members (chapter_id, member_name, friend_id) VALUES ($1, $2, $3)`,
          [chapter.id, m.name, m.friendId]
        );
      }

      await client.query("COMMIT");
      res.json({ ok: true, message: "Chapter created", chapter });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
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
// CHANGE 3: New function to check member deletability
// =========================================
async function getMemberDeletability(req, res) {
  try {
    const { id } = req.params; // chapterId
    const userId = req.user.userId;

    // Verify ownership
    const { rows: chap } = await db.query(
      "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
      [id, userId]
    );
    if (chap.length === 0) return res.status(403).json({ ok: false, message: "Unauthorized" });

    // Find members who appear in ANY expense (as payer OR split participant)
    const { rows } = await db.query(
      `SELECT DISTINCT cm.id
       FROM chapter_members cm
       WHERE cm.chapter_id = $1
         AND (
           EXISTS (SELECT 1 FROM expenses e WHERE e.payer_member_id = cm.id AND e.chapter_id = $1)
           OR
           EXISTS (SELECT 1 FROM expense_splits es JOIN expenses e ON es.expense_id = e.id WHERE es.member_id = cm.id AND e.chapter_id = $1)
         )`,
      [id]
    );

    const involvedIds = rows.map(r => r.id);
    res.json({ ok: true, involvedMemberIds: involvedIds });
  } catch (err) {
    console.error("getMemberDeletability error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// =========================================
// 4. Get All Chapters for Dashboard (Optimized)
// =========================================
async function getMyChapters(req, res) {
  try {
    const showArchived = req.query.archived === "true";
    // ✅ PATCH C APPLIED: Added c.is_personal to SELECT clause
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.description, c.created_at, c.last_opened_at, c.is_archived, c.is_personal, COUNT(cm.id) as member_count
       FROM chapters c LEFT JOIN chapter_members cm ON c.id = cm.chapter_id
       WHERE c.created_by = $1
         AND ($2 OR c.is_archived = FALSE)
       GROUP BY c.id ORDER BY c.created_at DESC`,
      [req.user.userId, showArchived]
    );
    res.json({ ok: true, chapters: rows });
  } catch (err) { 
    console.error("getMyChapters error:", err);
    res.status(500).json({ ok: false, message: "Server error" }); 
  }
}

// =========================================
// 5. Toggle Chapter Archive State
// =========================================
async function toggleArchiveChapter(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { is_archived } = req.body; // boolean

    const { rowCount } = await db.query(
      `UPDATE chapters SET is_archived = $1 WHERE id = $2 AND created_by = $3`,
      [!!is_archived, id, userId]
    );

    if (rowCount === 0) return res.status(404).json({ ok: false, message: "Chapter not found" });

    res.json({ 
      ok: true, 
      message: is_archived ? "Chapter archived" : "Chapter restored",
      is_archived: !!is_archived
    });
  } catch (err) {
    console.error("toggleArchiveChapter error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// =========================================
// 6. Get Single Chapter Details
// =========================================
async function getChapterDetails(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { rows: chapterRows } = await db.query(`SELECT * FROM chapters WHERE id = $1 AND created_by = $2`, [id, userId]);
    if (chapterRows.length === 0) return res.status(404).json({ ok: false, message: "Chapter not found" });

    await db.query(
      "UPDATE chapters SET last_opened_at = NOW() WHERE id = $1",
      [id]
    );

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
// 7. Delete Chapter - ✅ FIXED CASCADE ORDER
// =========================================
async function deleteChapter(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const client = await db.pool.connect();
    await client.query("BEGIN");
    
    try {
      // 1. Check ownership
      const { rows } = await client.query(
        "SELECT id FROM chapters WHERE id = $1 AND created_by = $2",
        [id, userId]
      );
      if (rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ ok: false, message: "Chapter not found" });
      }

      // Block deletion of personal chapter
      const { rows: chapInfo } = await client.query(
        "SELECT is_personal FROM chapters WHERE id = $1",
        [id]
      );
      if (chapInfo[0]?.is_personal) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          ok: false,
          message: "Your 'My Expenses' chapter cannot be deleted. It is your personal expense tracker."
        });
      }

      // 2. Delete in correct order: splits → expenses → members → chapter
      // (or rely entirely on DB CASCADE — all child tables have ON DELETE CASCADE)
      // Explicit order used here as a safety net in case CASCADE is misconfigured.
      await client.query(
        `DELETE FROM expense_splits WHERE expense_id IN (
           SELECT id FROM expenses WHERE chapter_id = $1
         )`,
        [id]
      );
      await client.query("DELETE FROM expenses WHERE chapter_id = $1", [id]);
      await client.query("DELETE FROM chapter_members WHERE chapter_id = $1", [id]);
      await client.query("DELETE FROM chapters WHERE id = $1", [id]);

      await client.query("COMMIT");
      res.json({ ok: true, message: "Chapter deleted successfully" });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("deleteChapter error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// Lightweight endpoint for collaborative polling.
// Returns only the last-modified timestamp — clients compare with their local state.
// If timestamps differ, client fetches full update.
// Future: Replace with WebSocket push notification.
async function getChapterHeartbeat(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // Verify user has access to this chapter
    // Note: Future collaborative features will need to check member access, not just creator
    const { rows } = await db.query(
      `SELECT c.data_updated_at, c.name
       FROM chapters c
       LEFT JOIN chapter_members cm ON c.id = cm.chapter_id AND cm.user_id = $2
       WHERE c.id = $1 AND (c.created_by = $2 OR cm.id IS NOT NULL)
       LIMIT 1`,
      [id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Chapter not found or no access" });
    }
    
    res.json({ 
      ok: true, 
      chapterId: id,
      dataUpdatedAt: rows[0].data_updated_at,
      // Cache this response very briefly — polling clients check every few seconds
      // The low max-age means fresh data arrives quickly
    });
    
    // Set cache header programmatically (short cache for polling)
    res.setHeader('Cache-Control', 'max-age=2, must-revalidate');
    
  } catch (err) {
    console.error("getChapterHeartbeat error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// CHANGE 4: Export the new function
module.exports = {
  createChapter,
  getMyChapters,
  getChapterDetails,
  updateChapter,
  deleteChapter,
  addMember,
  deleteMember,
  getMemberDeletability,
   getChapterHeartbeat,
  toggleArchiveChapter
};