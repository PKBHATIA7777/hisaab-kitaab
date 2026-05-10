/* server/controllers/personalChapterController.js */
/* Feature 3: "My Expenses" personal chapter + cross-chapter sync */

const db = require("../config/db");
const xss = require("xss");

// ─────────────────────────────────────────────────────────────
// Internal helper: create the "My Expenses" chapter for a user
// Called during registration AND from the API endpoint
// ─────────────────────────────────────────────────────────────
async function createPersonalChapterForUser(userId, client) {
  // Use passed client (for transactions) or db directly
  const q = client || db;

  // Check if already exists
  const { rows: existing } = await q.query(
    "SELECT id FROM chapters WHERE created_by = $1 AND is_personal = TRUE LIMIT 1",
    [userId]
  );
  if (existing.length > 0) return existing[0];

  // Fetch user name
  const { rows: userRows } = await q.query(
    "SELECT real_name FROM users WHERE id = $1",
    [userId]
  );
  const creatorName = userRows[0]?.real_name || "Me";

  // Create chapter
  const { rows: chapRows } = await q.query(
    `INSERT INTO chapters (name, description, created_by, is_personal)
     VALUES ('My Expenses', 'Your personal expense tracker', $1, TRUE)
     RETURNING *`,
    [userId]
  );
  const chapter = chapRows[0];

  // Add creator as sole member
  await q.query(
    `INSERT INTO chapter_members (chapter_id, member_name, user_id)
     VALUES ($1, $2, $3)`,
    [chapter.id, creatorName, userId]
  );

  return chapter;
}

// ─────────────────────────────────────────────────────────────
// POST /api/chapters/create-personal
// Create "My Expenses" chapter for existing user if missing
// ─────────────────────────────────────────────────────────────
async function createPersonalChapter(req, res) {
  try {
    const userId = req.user.userId;
    const chapter = await createPersonalChapterForUser(userId, null);
    res.json({ ok: true, message: "Personal chapter ready", chapter });
  } catch (err) {
    console.error("createPersonalChapter error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/chapters/personal/status
// Check if user has a personal chapter; returns it if so
// ─────────────────────────────────────────────────────────────
async function getPersonalChapterStatus(req, res) {
  try {
    const userId = req.user.userId;
    const { rows } = await db.query(
      "SELECT id, name FROM chapters WHERE created_by = $1 AND is_personal = TRUE LIMIT 1",
      [userId]
    );
    if (rows.length > 0) {
      return res.json({ ok: true, hasPersonalChapter: true, chapter: rows[0] });
    }
    // Lazily create for existing users — fire and forget, respond immediately
    setImmediate(() => {
      createPersonalChapterForUser(userId, null).catch(err =>
        console.error(`Lazy personal chapter for user ${userId}:`, err.message)
      );
    });
    res.json({ ok: true, hasPersonalChapter: false, chapter: null });
  } catch (err) {
    console.error("getPersonalChapterStatus error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/chapters/personal/add-from-chapter
// Add user's consumed amount from a chapter to My Expenses
// ─────────────────────────────────────────────────────────────
async function addToPersonalFromChapter(req, res) {
  try {
    const userId = req.user.userId;
    const { sourceChapterId, sourceMemberId, amount, categoryId } = req.body;

    if (!sourceChapterId || !sourceMemberId || !amount || amount <= 0) {
      return res.status(400).json({ ok: false, message: "Missing required fields" });
    }

    // Verify source chapter access
    const { rows: chap } = await db.query(
      "SELECT id, name FROM chapters WHERE id = $1 AND created_by = $2",
      [sourceChapterId, userId]
    );
    if (chap.length === 0) {
      return res.status(403).json({ ok: false, message: "Unauthorized" });
    }
    const sourceChapterName = chap[0].name;

    // Get or create personal chapter
    const personalChapter = await createPersonalChapterForUser(userId, null);

    // Get personal chapter member ID (the sole member — the user themselves)
    const { rows: myMember } = await db.query(
      "SELECT id FROM chapter_members WHERE chapter_id = $1 AND user_id = $2 LIMIT 1",
      [personalChapter.id, userId]
    );
    if (myMember.length === 0) {
      return res.status(500).json({ ok: false, message: "Personal chapter member not found" });
    }
    const myMemberId = myMember[0].id;

    // Check if an expense from this source chapter already exists in personal chapter
    const { rows: existingSync } = await db.query(
      `SELECT id FROM expenses
       WHERE chapter_id = $1 AND source_chapter_id = $2 AND source_member_id = $3
         AND is_synced_from_chapter = TRUE
       LIMIT 1`,
      [personalChapter.id, sourceChapterId, sourceMemberId]
    );

    if (existingSync.length > 0) {
      return res.status(400).json({
        ok: false,
        message: "Already synced. Use the update option to reflect changes.",
        existingExpenseId: existingSync[0].id
      });
    }

    const client = await db.pool.connect();
    await client.query("BEGIN");

    try {
      // Insert expense into personal chapter
      const { rows: expRows } = await client.query(
        `INSERT INTO expenses
           (chapter_id, payer_member_id, amount, description, expense_date,
            source_chapter_id, source_member_id, is_synced_from_chapter,
            sync_consumed_snapshot, category_id)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6, TRUE, $3, $7)
         RETURNING id`,
        [personalChapter.id, myMemberId, amount,
         xss(sourceChapterName), sourceChapterId, sourceMemberId, categoryId || null]
      );
      const expenseId = expRows[0].id;

      // Insert split (solo — only the user themselves)
      await client.query(
        `INSERT INTO expense_splits (expense_id, member_id, amount_owed)
         VALUES ($1, $2, $3)`,
        [expenseId, myMemberId, amount]
      );

      await client.query("COMMIT");
      res.json({ ok: true, message: "Added to My Expenses", expenseId });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("addToPersonalFromChapter error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/chapters/:chapterId/sync-status
// Check if current user's synced expenses are stale
// ─────────────────────────────────────────────────────────────
async function getSyncStatus(req, res) {
  try {
    const { chapterId } = req.params;
    const userId = req.user.userId;

    // Find the user's member in this chapter
    const { rows: memberRows } = await db.query(
      "SELECT id FROM chapter_members WHERE chapter_id = $1 AND user_id = $2 LIMIT 1",
      [chapterId, userId]
    );
    if (memberRows.length === 0) {
      return res.json({ ok: true, isDirty: false, currentConsumed: 0, syncedConsumed: 0 });
    }
    const myMemberId = memberRows[0].id;

    // Calculate current consumed amount in this chapter
    const { rows: consumedRows } = await db.query(
      `SELECT COALESCE(SUM(es.amount_owed), 0) AS total
       FROM expense_splits es
       JOIN expenses e ON es.expense_id = e.id
       WHERE e.chapter_id = $1 AND es.member_id = $2`,
      [chapterId, myMemberId]
    );
    const currentConsumed = parseFloat(consumedRows[0].total);

    // Find synced expense in personal chapter
    const { rows: syncedRows } = await db.query(
      `SELECT id, sync_consumed_snapshot, sync_dismissed, amount
       FROM expenses
       WHERE source_chapter_id = $1 AND source_member_id = $2
         AND is_synced_from_chapter = TRUE
       LIMIT 1`,
      [chapterId, myMemberId]
    );

    if (syncedRows.length === 0) {
      return res.json({ ok: true, isDirty: false, currentConsumed, syncedConsumed: 0, hasSynced: false });
    }

    const synced = syncedRows[0];
    const syncedConsumed = parseFloat(synced.sync_consumed_snapshot || synced.amount);
    const diff = Math.abs(currentConsumed - syncedConsumed);
    const isDirty = diff > 0.01 && !synced.sync_dismissed;

    res.json({
      ok: true,
      isDirty,
      currentConsumed,
      syncedConsumed,
      hasSynced: true,
      syncedExpenseId: synced.id,
      dismissed: synced.sync_dismissed
    });
  } catch (err) {
    console.error("getSyncStatus error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/chapters/:chapterId/sync-update
// Update the synced personal expense with new consumed amount
// ─────────────────────────────────────────────────────────────
async function updateSyncedExpense(req, res) {
  try {
    const { chapterId } = req.params;
    const userId = req.user.userId;
    const { action } = req.body; // "update" | "dismiss"

    // Find the user's member in this chapter
    const { rows: memberRows } = await db.query(
      "SELECT id FROM chapter_members WHERE chapter_id = $1 AND user_id = $2 LIMIT 1",
      [chapterId, userId]
    );
    if (memberRows.length === 0) {
      return res.status(404).json({ ok: false, message: "Not a member of this chapter" });
    }
    const myMemberId = memberRows[0].id;

    // Find the synced expense
    const { rows: syncedRows } = await db.query(
      `SELECT e.id, e.chapter_id AS personal_chapter_id
       FROM expenses e
       WHERE e.source_chapter_id = $1 AND e.source_member_id = $2
         AND e.is_synced_from_chapter = TRUE
       LIMIT 1`,
      [chapterId, myMemberId]
    );
    if (syncedRows.length === 0) {
      return res.status(404).json({ ok: false, message: "No synced expense found" });
    }

    const synced = syncedRows[0];

    if (action === "dismiss") {
      await db.query(
        "UPDATE expenses SET sync_dismissed = TRUE WHERE id = $1",
        [synced.id]
      );
      return res.json({ ok: true, message: "Warning dismissed" });
    }

    // action = "update"
    // Recalculate current consumed
    const { rows: consumedRows } = await db.query(
      `SELECT COALESCE(SUM(es.amount_owed), 0) AS total
       FROM expense_splits es
       JOIN expenses e ON es.expense_id = e.id
       WHERE e.chapter_id = $1 AND es.member_id = $2`,
      [chapterId, myMemberId]
    );
    const newAmount = parseFloat(consumedRows[0].total);

    if (newAmount <= 0) {
      return res.status(400).json({ ok: false, message: "Consumed amount is 0, nothing to update" });
    }

    const client = await db.pool.connect();
    await client.query("BEGIN");
    try {
      // Update expense amount
      await client.query(
        `UPDATE expenses
         SET amount = $1, sync_consumed_snapshot = $1, sync_dismissed = FALSE
         WHERE id = $2`,
        [newAmount, synced.id]
      );

      // Update split amount (solo split)
      const { rows: personalMember } = await client.query(
        "SELECT id FROM chapter_members WHERE chapter_id = $1 AND user_id = $2 LIMIT 1",
        [synced.personal_chapter_id, userId]
      );
      if (personalMember.length > 0) {
        await client.query(
          "UPDATE expense_splits SET amount_owed = $1 WHERE expense_id = $2 AND member_id = $3",
          [newAmount, synced.id, personalMember[0].id]
        );
      }

      await client.query("COMMIT");
      res.json({ ok: true, message: "My Expenses updated with latest amount", newAmount });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("updateSyncedExpense error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

module.exports = {
  createPersonalChapterForUser,
  createPersonalChapter,
  getPersonalChapterStatus,
  addToPersonalFromChapter,
  getSyncStatus,
  updateSyncedExpense,
};