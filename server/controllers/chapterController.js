/* server/controllers/chapterController.js */
const db = require("../config/db");
const { z } = require("zod");
const xss = require("xss");
const log = require("../utils/logger");

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
  isCollaborative: z.boolean().optional().default(false),
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
      const isCollab = result.data.isCollaborative;
      const { rows: chapterRows } = await client.query(
        `INSERT INTO chapters (name, description, created_by, is_collaborative) VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, description, userId, isCollab]
      );
      const chapter = chapterRows[0];

      // ✅ PATCH B APPLIED: Insert Creator (skip if explicitly excluded — Feature 2)
      const creatorExcluded = req.body.creatorExcluded === true || req.body.creatorExcluded === 'true';
      if (!creatorExcluded) {
        await client.query(
          `INSERT INTO chapter_members (chapter_id, member_name, user_id, role, status, joined_at) VALUES ($1, $2, $3, 'admin', 'active', NOW())`,
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
    log.error({ err }, "createChapter error");
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

    // Access is verified by chapterAccessMiddleware

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
    log.error({ err }, "addMember error");
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

    // Access is verified by chapterAccessMiddleware

    // Prevent deleting the Admin
    const { rows: member } = await db.query("SELECT role FROM chapter_members WHERE id = $1", [memberId]);
    if (member.length > 0 && member[0].role === 'admin') {
      return res.status(400).json({ ok: false, message: "Cannot remove the chapter admin" });
    }

    // SECURITY FIX: Backend validation for involvement in expenses
    const { rows: involved } = await db.query(
      `SELECT 1
       FROM expenses e
       WHERE e.chapter_id = $1 AND (
         e.payer_member_id = $2
         OR EXISTS (SELECT 1 FROM expense_splits es WHERE es.expense_id = e.id AND es.member_id = $2)
       ) LIMIT 1`,
      [id, memberId]
    );

    if (involved.length > 0) {
      return res.status(400).json({ ok: false, message: "Cannot remove a member who is involved in expenses. They must be removed from all expenses first." });
    }

    // Soft Delete: Set status to 'removed' instead of hard deleting
    await db.query(
      "UPDATE chapter_members SET status = 'removed', left_at = NOW() WHERE id = $1 AND chapter_id = $2", 
      [memberId, id]
    );

    res.json({ ok: true, message: "Member removed" });
  } catch (err) {
    log.error({ err }, "deleteMember error");
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

    // Access is verified by chapterAccessMiddleware

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
    log.error({ err }, "getMemberDeletability error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// =========================================
// NEW: Upgrade Chapter to Collaborative
// =========================================
async function upgradeToCollaborative(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // Access is verified by chapterAccessMiddleware (must be admin)
    if (req.chapter.is_collaborative) {
      return res.status(400).json({ ok: false, message: "Chapter is already collaborative" });
    }

    const client = await db.pool.connect();
    await client.query("BEGIN");
    try {
      // SECURITY FIX: Ensure the creator has an active admin row mapped to their user_id
      const { rows: userRows } = await client.query("SELECT real_name FROM users WHERE id = $1", [userId]);
      const creatorName = userRows[0]?.real_name || "Admin";

      // Check if they already have a mapped row
      const { rows: existingMapping } = await client.query(
        "SELECT id FROM chapter_members WHERE chapter_id = $1 AND user_id = $2 AND status = 'active'",
        [id, userId]
      );

      if (existingMapping.length === 0) {
        // They don't have a mapped row. Let's try to find a ghost row we can commandeer
        const { rows: ghostRows } = await client.query(
          `SELECT id FROM chapter_members 
           WHERE chapter_id = $1 AND user_id IS NULL AND status = 'active'
           ORDER BY id ASC LIMIT 1`,
          [id]
        );

        if (ghostRows.length > 0) {
          // Commandeer the ghost row
          await client.query(
            "UPDATE chapter_members SET user_id = $1, role = 'admin' WHERE id = $2",
            [userId, ghostRows[0].id]
          );
        } else {
          // No suitable ghost row. Insert a brand new one.
          await client.query(
            `INSERT INTO chapter_members (chapter_id, user_id, member_name, role, status, joined_at)
             VALUES ($1, $2, $3, 'admin', 'active', NOW())`,
            [id, userId, creatorName]
          );
        }
      } else {
        // Ensure their existing row is admin
        await client.query(
          "UPDATE chapter_members SET role = 'admin' WHERE id = $1",
          [existingMapping[0].id]
        );
      }

      await client.query("UPDATE chapters SET is_collaborative = TRUE WHERE id = $1", [id]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    
    res.json({ ok: true, message: "Chapter upgraded to collaborative mode successfully!" });
  } catch (err) {
    log.error({ err }, "upgradeToCollaborative error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// =========================================
// NEW: Leave Chapter
// =========================================
async function leaveChapter(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const chapterMember = req.chapterMember; // From middleware

    if (!req.chapter.is_collaborative) {
      return res.status(400).json({ ok: false, message: "Cannot leave a non-collaborative chapter" });
    }

    if (!chapterMember || chapterMember.status !== 'active') {
      return res.status(400).json({ ok: false, message: "You are not an active member of this chapter" });
    }

    // If they are the only admin, block them from leaving (they must delete chapter or transfer)
    if (chapterMember.role === 'admin') {
      const { rows: admins } = await db.query(
        "SELECT id FROM chapter_members WHERE chapter_id = $1 AND role = 'admin' AND status = 'active'",
        [id]
      );
      if (admins.length <= 1) {
        return res.status(400).json({ ok: false, message: "You are the only admin. You cannot leave the chapter without transferring ownership or deleting it." });
      }
    }

    // SECURITY FIX: Enforce zero balance before allowing user to leave
    const { rows: balanceRows } = await db.query(
      `WITH spent AS (
         SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE chapter_id = $1 AND payer_member_id = $2
       ),
       used AS (
         SELECT COALESCE(SUM(es.amount_owed), 0) as total FROM expense_splits es JOIN expenses e ON es.expense_id = e.id WHERE e.chapter_id = $1 AND es.member_id = $2
       ),
       paid_out AS (
         SELECT COALESCE(SUM(amount), 0) as total FROM settlement_records WHERE chapter_id = $1 AND from_member_id = $2 AND (confirmation_status = 'confirmed' OR confirmation_status = 'auto_confirmed')
       ),
       received AS (
         SELECT COALESCE(SUM(amount), 0) as total FROM settlement_records WHERE chapter_id = $1 AND to_member_id = $2 AND (confirmation_status = 'confirmed' OR confirmation_status = 'auto_confirmed')
       )
       SELECT 
         (spent.total - used.total + paid_out.total - received.total) AS net_balance
       FROM spent, used, paid_out, received`,
      [id, chapterMember.id]
    );

    const netBalance = parseFloat(balanceRows[0].net_balance || 0);

    if (Math.abs(netBalance) >= 0.01) {
      return res.status(400).json({ ok: false, message: "You cannot leave this chapter because you have an outstanding balance. Please settle all debts before leaving." });
    }

    await db.query(
      "UPDATE chapter_members SET status = 'left', left_at = NOW() WHERE id = $1",
      [chapterMember.id]
    );

    res.json({ ok: true, message: "You have left the chapter" });
  } catch (err) {
    log.error({ err }, "leaveChapter error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// =========================================
// 4. Get All Chapters for Dashboard (Optimized)
// =========================================
async function getMyChapters(req, res) {
  try {
    const showArchived = req.query.archived === "true";
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.description, c.created_at, c.last_opened_at, c.is_archived, c.is_personal, c.is_collaborative, COUNT(cm.id) FILTER (WHERE cm.status = 'active') as member_count,
         COALESCE((
           SELECT SUM(e.amount)
           FROM chapter_members ucm
           JOIN expenses e ON e.payer_member_id = ucm.id
           WHERE ucm.chapter_id = c.id AND ucm.user_id = $1
         ), 0) - COALESCE((
           SELECT SUM(es.amount_owed)
           FROM chapter_members ucm
           JOIN expense_splits es ON es.member_id = ucm.id
           JOIN expenses e ON es.expense_id = e.id
           WHERE ucm.chapter_id = c.id AND ucm.user_id = $1 AND e.chapter_id = c.id
         ), 0) + COALESCE((
           SELECT SUM(sr.amount)
           FROM chapter_members ucm
           JOIN settlement_records sr ON sr.from_member_id = ucm.id
           WHERE ucm.chapter_id = c.id AND ucm.user_id = $1 AND (sr.confirmation_status = 'confirmed' OR sr.confirmation_status = 'auto_confirmed')
         ), 0) - COALESCE((
           SELECT SUM(sr.amount)
           FROM chapter_members ucm
           JOIN settlement_records sr ON sr.to_member_id = ucm.id
           WHERE ucm.chapter_id = c.id AND ucm.user_id = $1 AND (sr.confirmation_status = 'confirmed' OR sr.confirmation_status = 'auto_confirmed')
         ), 0) as user_net_balance
       FROM chapters c LEFT JOIN chapter_members cm ON c.id = cm.chapter_id
       WHERE (
           (c.created_by = $1 AND c.is_collaborative = FALSE) 
           OR EXISTS (
             SELECT 1 FROM chapter_members acc 
             WHERE acc.chapter_id = c.id AND acc.user_id = $1 AND acc.status = 'active'
           )
         )
         AND ($2 OR c.is_archived = FALSE)
       GROUP BY c.id ORDER BY c.created_at DESC`,
      [req.user.userId, showArchived]
    );
    res.json({ ok: true, chapters: rows });
  } catch (err) { 
    log.error({ err }, "getMyChapters error");
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
      `UPDATE chapters SET is_archived = $1 WHERE id = $2`,
      [!!is_archived, id]
    );

    if (rowCount === 0) return res.status(404).json({ ok: false, message: "Chapter not found" });

    res.json({ 
      ok: true, 
      message: is_archived ? "Chapter archived" : "Chapter restored",
      is_archived: !!is_archived
    });
  } catch (err) {
    log.error({ err }, "toggleArchiveChapter error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// =========================================
// 6. Get Single Chapter Details
// =========================================
async function getChapterDetails(req, res) {
  try {
    const { id } = req.params;
    
    // Access is verified by chapterAccessMiddleware
    const { rows: chapterRows } = await db.query(`SELECT * FROM chapters WHERE id = $1`, [id]);
    if (chapterRows.length === 0) return res.status(404).json({ ok: false, message: "Chapter not found" });

    await db.query(
      "UPDATE chapters SET last_opened_at = NOW() WHERE id = $1",
      [id]
    );

    // Fetch members with user_id so frontend knows who is Admin
    const { rows: memberRows } = await db.query(`SELECT * FROM chapter_members WHERE chapter_id = $1 AND status != 'removed' ORDER BY id ASC`, [id]);
    
    res.json({ ok: true, chapter: chapterRows[0], members: memberRows });
  } catch (err) { 
    log.error({ err }, "getChapterDetails error");
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
      `UPDATE chapters SET name = $1, description = $2 WHERE id = $3`,
      [sanitizedName, sanitizedDescription, id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: "Chapter not found or unauthorized" });
    }

    res.json({ ok: true, message: "Chapter updated" });
  } catch (err) {
    log.error({ err }, "updateChapter error");
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
      // Access is verified by chapterAccessMiddleware
      
      // Block deletion of personal chapter
      if (req.chapter.is_personal) {
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
    log.error({ err }, "deleteChapter error");
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
    
    // Access is verified by chapterAccessMiddleware
    
    // Set cache header programmatically (short cache for polling)
    res.setHeader('Cache-Control', 'max-age=2, must-revalidate');

    res.json({ 
      ok: true, 
      chapterId: id,
      dataUpdatedAt: req.chapter.data_updated_at || new Date(),
      // Cache this response very briefly — polling clients check every few seconds
      // The low max-age means fresh data arrives quickly
    });
    
  } catch (err) {
    log.error({ err }, "getChapterHeartbeat error");
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
  toggleArchiveChapter,
  upgradeToCollaborative,
  leaveChapter
};