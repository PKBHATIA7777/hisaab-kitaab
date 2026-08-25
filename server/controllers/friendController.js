/* server/controllers/friendController.js */
const db = require("../config/db");
const { z } = require("zod");
const xss = require("xss");
const log = require("../utils/logger");
const { calculateSettlements } = require("./expenseController");

// --- VALIDATION SCHEMAS ---
const friendSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).trim(),
  username: z.string().min(1, "Username is required").max(50).trim(),
  email: z.string().email("Invalid email address").trim(),
  phone: z.string().max(20).optional().or(z.literal("")),
  mobile: z.string().max(20).optional().or(z.literal(""))
});

// 1. Add Friend
async function addFriend(req, res) {
  try {
    const result = friendSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ ok: false, message: result.error.issues[0].message });

    const { name, username, email, phone, mobile } = result.data;
    const userId = req.user.userId;

    const { rows } = await db.query(
      `INSERT INTO friends (user_id, name, username, email, phone, mobile)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, xss(name), xss(username), xss(email.toLowerCase()), xss(phone||""), xss(mobile||"")]
    );

    res.json({ ok: true, message: "Friend added successfully", friend: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ ok: false, message: "Friend with this username already exists." });
    log.error({ err }, "addFriend error");
    res.status(500).json({ ok: false, message: "Failed to add friend" });
  }
}

// 2. Get All Friends (Robust / Fail-Safe)
async function getFriends(req, res) {
  const userId = req.user.userId;

  // QUERY A: Advanced (With Balances)
  const settlementQuery = `
      WITH user_friends AS (
        SELECT id FROM friends WHERE user_id = $1
      ),
      spent_cte AS (
        SELECT e.payer_member_id as member_id, SUM(e.amount) as total_spent
        FROM expenses e
        JOIN chapter_members cm ON e.payer_member_id = cm.id
        WHERE cm.friend_id IN (SELECT id FROM user_friends)
        GROUP BY e.payer_member_id
      ),
      used_cte AS (
        SELECT es.member_id, SUM(es.amount_owed) as total_used
        FROM expense_splits es
        JOIN chapter_members cm ON es.member_id = cm.id
        WHERE cm.friend_id IN (SELECT id FROM user_friends)
        GROUP BY es.member_id
      ),
      friend_balances AS (
        SELECT 
          cm.friend_id,
          SUM(COALESCE(s.total_spent, 0) - COALESCE(u.total_used, 0)) as net_amount
        FROM chapter_members cm
        LEFT JOIN spent_cte s ON cm.id = s.member_id
        LEFT JOIN used_cte u ON cm.id = u.member_id
        WHERE cm.friend_id IN (SELECT id FROM user_friends)
        GROUP BY cm.friend_id
      )
      SELECT 
        f.id, f.user_id, f.name, f.username, f.email, f.phone, f.mobile,
        COALESCE(fb.net_amount * 100, 0)::INTEGER as total_balance
      FROM friends f
      LEFT JOIN friend_balances fb ON f.id = fb.friend_id
      WHERE f.user_id = $1
      ORDER BY f.name ASC;
  `;

  // QUERY B: Simple Fallback
  const simpleQuery = `SELECT * FROM friends WHERE user_id = $1 ORDER BY name ASC`;

  try {
    const { rows } = await db.query(settlementQuery, [userId]);
    return res.json({ ok: true, friends: rows });
  } catch (err) {
    log.warn({ err }, "Settlement Query failed. Falling back to simple list.");
    try {
      const { rows } = await db.query(simpleQuery, [userId]);
      const friendsWithZero = rows.map(f => ({ ...f, total_balance: 0 }));
      return res.json({ ok: true, friends: friendsWithZero });
    } catch (fallbackErr) {
      log.error({ err: fallbackErr }, "Critical Database Error in getFriends fallback");
      return res.status(500).json({ ok: false, message: "Server error" });
    }
  }
}

// 3. Update Friend
async function updateFriend(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const result = friendSchema.safeParse(req.body);
    
    if (!result.success) return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    const { name, username, email, phone, mobile } = result.data;

    const { rowCount, rows } = await db.query(
      `UPDATE friends 
       SET name=$1, username=$2, email=$3, phone=$4, mobile=$5, updated_at=NOW()
       WHERE id=$6 AND user_id=$7 RETURNING *`,
      [xss(name), xss(username), xss(email.toLowerCase()), xss(phone||""), xss(mobile||""), id, userId]
    );

    if (rowCount === 0) return res.status(404).json({ ok: false, message: "Friend not found" });
    res.json({ ok: true, message: "Friend updated", friend: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ ok: false, message: "Username already taken." });
    log.error({ err }, "updateFriend error");
    res.status(500).json({ ok: false, message: "Failed to update" });
  }
}

// 4. Delete Friend
async function deleteFriend(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { rowCount } = await db.query("DELETE FROM friends WHERE id = $1 AND user_id = $2", [id, userId]);
    if (rowCount === 0) return res.status(404).json({ ok: false, message: "Friend not found" });
    res.json({ ok: true, message: "Friend deleted" });
  } catch (err) {
    log.error({ err }, "deleteFriend error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// 5. Get Friend Settlements
async function getFriendSettlements(req, res) {
  try {
    const { friendId } = req.params;
    const userId = req.user.userId;

    const { rows: friendRows } = await db.query(
      "SELECT id, name FROM friends WHERE id = $1 AND user_id = $2",
      [friendId, userId]
    );
    if (friendRows.length === 0) {
      return res.status(404).json({ ok: false, message: "Friend not found" });
    }
    const friendName = friendRows[0].name;

    // Single query: get all chapters, their members, friend's member entry, and my member entry
    const { rows: memberships } = await db.query(
      `SELECT
         cm.chapter_id,
         cm.id AS friend_member_id,
         c.name AS chapter_name,
         my_cm.id AS my_member_id
       FROM chapter_members cm
       JOIN chapters c ON cm.chapter_id = c.id
       JOIN chapter_members my_cm
         ON my_cm.chapter_id = cm.chapter_id
         AND my_cm.user_id = $2
       WHERE cm.friend_id = $1`,
      [friendId, userId]
    );

    if (memberships.length === 0) {
      return res.json({ ok: true, friendName, grandTotal: "0.00", chapters: [] });
    }

    const chapterIds = memberships.map(m => m.chapter_id);

    // Single batched query for all balances across all relevant chapters
    const { rows: balanceRows } = await db.query(
      `WITH spent_cte AS (
         SELECT e.chapter_id, e.payer_member_id, SUM(e.amount) AS total
         FROM expenses e
         WHERE e.chapter_id = ANY($1)
         GROUP BY e.chapter_id, e.payer_member_id
       ),
       used_cte AS (
         SELECT e.chapter_id, es.member_id, SUM(es.amount_owed) AS total
         FROM expense_splits es
         JOIN expenses e ON es.expense_id = e.id
         WHERE e.chapter_id = ANY($1)
         GROUP BY e.chapter_id, es.member_id
       )
       SELECT
         cm.chapter_id,
         cm.id,
         cm.member_name,
         COALESCE(s.total, 0) AS total_spent,
         COALESCE(u.total, 0) AS total_used
       FROM chapter_members cm
       LEFT JOIN spent_cte s ON cm.id = s.payer_member_id AND cm.chapter_id = s.chapter_id
       LEFT JOIN used_cte u ON cm.id = u.member_id AND cm.chapter_id = u.chapter_id
       WHERE cm.chapter_id = ANY($1)`,
      [chapterIds]
    );

    // Group balance rows by chapter_id
    const balancesByChapter = {};
    for (const row of balanceRows) {
      if (!balancesByChapter[row.chapter_id]) balancesByChapter[row.chapter_id] = [];
      balancesByChapter[row.chapter_id].push({
        id: Number(row.id),
        name: row.member_name,
        balance: parseFloat(row.total_spent) - parseFloat(row.total_used)
      });
    }

    let grandTotal = 0;
    const chapterDetails = [];

    for (const ship of memberships) {
      const members = balancesByChapter[ship.chapter_id] || [];
      const settlements = calculateSettlements(members);

      const myMemberId = Number(ship.my_member_id);
      const friendMemberId = Number(ship.friend_member_id);

      let amount = 0;
      const iOweThem = settlements.find(
        s => Number(s.fromId) === myMemberId && Number(s.toId) === friendMemberId
      );
      const theyOweMe = settlements.find(
        s => Number(s.fromId) === friendMemberId && Number(s.toId) === myMemberId
      );

      if (iOweThem) amount = -parseFloat(iOweThem.amount);
      else if (theyOweMe) amount = parseFloat(theyOweMe.amount);

      chapterDetails.push({
        chapterId: ship.chapter_id,
        chapterName: ship.chapter_name,
        balance: amount
      });
      grandTotal += amount;
    }

    res.json({ ok: true, friendName, grandTotal: grandTotal.toFixed(2), chapters: chapterDetails });
  } catch (err) {
    log.error({ err }, "getFriendSettlements error");
    res.status(500).json({ ok: false, message: "Failed to load settlements" });
  }
}

module.exports = { 
  addFriend, 
  getFriends, 
  updateFriend, 
  deleteFriend, 
  getFriendSettlements 
};

