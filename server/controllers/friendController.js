/* server/controllers/friendController.js */
const db = require("../config/db");
const { z } = require("zod");
const xss = require("xss");

// --- VALIDATION SCHEMAS ---
const friendSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).trim(),
  username: z.string().min(1, "Username is required").max(50).trim(),
  email: z.string().email("Invalid email address").trim(),
  phone: z.string().max(20).optional().or(z.literal("")),
  mobile: z.string().max(20).optional().or(z.literal(""))
});

// =========================================
// 1. Add Friend
// =========================================
async function addFriend(req, res) {
  try {
    const result = friendSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    }

    const { name, username, email, phone, mobile } = result.data;
    const userId = req.user.userId;

    // Sanitize inputs
    const cleanName = xss(name);
    const cleanUsername = xss(username);
    const cleanEmail = xss(email.toLowerCase());
    const cleanPhone = xss(phone || "");
    const cleanMobile = xss(mobile || "");

    const { rows } = await db.query(
      `INSERT INTO friends (user_id, name, username, email, phone, mobile)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, cleanName, cleanUsername, cleanEmail, cleanPhone, cleanMobile]
    );

    res.json({ ok: true, message: "Friend added successfully", friend: rows[0] });

  } catch (err) {
    // Unique constraint violation code in Postgres
    if (err.code === '23505') { 
      return res.status(400).json({ ok: false, message: "You already have a friend with this username." });
    }
    console.error("addFriend error:", err);
    res.status(500).json({ ok: false, message: "Failed to add friend" });
  }
}

// =========================================
// 2. Get All Friends
// =========================================
async function getFriends(req, res) {
  try {
    const userId = req.user.userId;
    const { rows } = await db.query(
      `SELECT * FROM friends WHERE user_id = $1 ORDER BY name ASC`,
      [userId]
    );
    res.json({ ok: true, friends: rows });
  } catch (err) {
    console.error("getFriends error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// =========================================
// 3. Update Friend
// =========================================
async function updateFriend(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = friendSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    }

    const { name, username, email, phone, mobile } = result.data;

    // Sanitize
    const cleanName = xss(name);
    const cleanUsername = xss(username);
    const cleanEmail = xss(email.toLowerCase());
    const cleanPhone = xss(phone || "");
    const cleanMobile = xss(mobile || "");

    const { rowCount, rows } = await db.query(
      `UPDATE friends 
       SET name = $1, username = $2, email = $3, phone = $4, mobile = $5, updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [cleanName, cleanUsername, cleanEmail, cleanPhone, cleanMobile, id, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: "Friend not found or unauthorized" });
    }

    res.json({ ok: true, message: "Friend updated", friend: rows[0] });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ ok: false, message: "You already have a friend with this username." });
    }
    console.error("updateFriend error:", err);
    res.status(500).json({ ok: false, message: "Failed to update friend" });
  }
}

// =========================================
// 4. Delete Friend
// =========================================
async function deleteFriend(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const { rowCount } = await db.query(
      "DELETE FROM friends WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: "Friend not found" });
    }

    res.json({ ok: true, message: "Friend deleted" });
  } catch (err) {
    console.error("deleteFriend error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

module.exports = {
  addFriend,
  getFriends,
  updateFriend,
  deleteFriend
};