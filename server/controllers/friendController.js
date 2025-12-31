/* server/controllers/friendController.js */
const db = require("../config/db");
const { z } = require("zod");
const xss = require("xss");
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
    console.error("addFriend error:", err);
    res.status(500).json({ ok: false, message: "Failed to add friend" });
  }
}

// 2. Get All Friends (Robust / Fail-Safe)
async function getFriends(req, res) {
  const userId = req.user.userId;

  // QUERY A: Advanced (With Balances)
  const settlementQuery = `
      WITH friend_balances AS (
        SELECT 
          cm.friend_id,
          SUM(
            COALESCE((SELECT SUM(amount) FROM expenses WHERE payer_member_id = cm.id), 0) - 
            COALESCE((SELECT SUM(amount_owed) FROM expense_splits WHERE member_id = cm.id), 0)
          ) as net_amount
        FROM chapter_members cm
        WHERE cm.friend_id IS NOT NULL
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
    console.warn("⚠️ Settlement Query failed. Falling back to simple list.");
    try {
      const { rows } = await db.query(simpleQuery, [userId]);
      const friendsWithZero = rows.map(f => ({ ...f, total_balance: 0 }));
      return res.json({ ok: true, friends: friendsWithZero });
    } catch (fallbackErr) {
      console.error("❌ Critical Database Error:", fallbackErr);
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
    console.error("updateFriend error:", err);
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
    console.error("deleteFriend error:", err);
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
    if (friendRows.length === 0) return res.status(404).json({ ok: false, message: "Friend not found" });
    
    const friendName = friendRows[0].name;

    const { rows: memberships } = await db.query(
      `SELECT cm.chapter_id, cm.id as friend_member_id, c.name as chapter_name
       FROM chapter_members cm
       JOIN chapters c ON cm.chapter_id = c.id
       WHERE cm.friend_id = $1`,
      [friendId]
    );

    let grandTotal = 0;
    const chapterDetails = [];

    for (const ship of memberships) {
      const { chapter_id, friend_member_id, chapter_name } = ship;

      const { rows: myMemberRows } = await db.query(
        "SELECT id FROM chapter_members WHERE chapter_id = $1 AND user_id = $2",
        [chapter_id, userId]
      );
      if (myMemberRows.length === 0) continue;
      const myMemberId = myMemberRows[0].id;

      const queryText = `
        WITH spent_cte AS (
          SELECT payer_member_id, SUM(amount) as total
          FROM expenses WHERE chapter_id = $1 GROUP BY payer_member_id
        ),
        used_cte AS (
          SELECT es.member_id, SUM(es.amount_owed) as total
          FROM expense_splits es
          JOIN expenses e ON es.expense_id = e.id
          WHERE e.chapter_id = $1
          GROUP BY es.member_id
        )
        SELECT 
          cm.id, cm.member_name, 
          COALESCE(s.total, 0) as total_spent, COALESCE(u.total, 0) as total_used
        FROM chapter_members cm
        LEFT JOIN spent_cte s ON cm.id = s.payer_member_id
        LEFT JOIN used_cte u ON cm.id = u.member_id
        WHERE cm.chapter_id = $1
      `;
      const { rows: balances } = await db.query(queryText, [chapter_id]);
      
      const formattedBalances = balances.map(b => ({
        id: b.id,
        name: b.member_name,
        balance: parseFloat(b.total_spent) - parseFloat(b.total_used)
      }));

      const settlements = calculateSettlements(formattedBalances);
      let amount = 0;

      const iOweThem = settlements.find(s => s.fromId === myMemberId && s.toId === friend_member_id);
      const theyOweMe = settlements.find(s => s.fromId === friend_member_id && s.toId === myMemberId);

      if (iOweThem) amount = -parseFloat(iOweThem.amount);
      else if (theyOweMe) amount = parseFloat(theyOweMe.amount);

      chapterDetails.push({ chapterId: chapter_id, chapterName: chapter_name, balance: amount });
      grandTotal += amount;
    }

    res.json({ ok: true, friendName, grandTotal: grandTotal.toFixed(2), chapters: chapterDetails });
  } catch (err) {
    console.error("getFriendSettlements error:", err);
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

// /* server/controllers/friendController.js */
// const db = require("../config/db");
// const { z } = require("zod");
// const xss = require("xss");
// // ✅ Import Settlement Algorithm
// const { calculateSettlements } = require("./expenseController");

// // --- VALIDATION SCHEMAS ---
// const friendSchema = z.object({
//   name: z.string().min(1, "Name is required").max(100).trim(),
//   username: z.string().min(1, "Username is required").max(50).trim(),
//   email: z.string().email("Invalid email address").trim(),
//   phone: z.string().max(20).optional().or(z.literal("")),
//   mobile: z.string().max(20).optional().or(z.literal(""))
// });

// // =========================================
// // 1. Add Friend
// // =========================================
// async function addFriend(req, res) {
//   try {
//     const result = friendSchema.safeParse(req.body);
//     if (!result.success) {
//       return res.status(400).json({ ok: false, message: result.error.issues[0].message });
//     }

//     const { name, username, email, phone, mobile } = result.data;
//     const userId = req.user.userId;

//     // Sanitize inputs
//     const cleanName = xss(name);
//     const cleanUsername = xss(username);
//     const cleanEmail = xss(email.toLowerCase());
//     const cleanPhone = xss(phone || "");
//     const cleanMobile = xss(mobile || "");

//     const { rows } = await db.query(
//       `INSERT INTO friends (user_id, name, username, email, phone, mobile)
//        VALUES ($1, $2, $3, $4, $5, $6)
//        RETURNING *`,
//       [userId, cleanName, cleanUsername, cleanEmail, cleanPhone, cleanMobile]
//     );

//     res.json({ ok: true, message: "Friend added successfully", friend: rows[0] });

//   } catch (err) {
//     if (err.code === '23505') { 
//       return res.status(400).json({ ok: false, message: "You already have a friend with this username." });
//     }
//     console.error("addFriend error:", err);
//     res.status(500).json({ ok: false, message: "Failed to add friend" });
//   }
// }

// // =========================================
// // 2. Get All Friends (CORRECTED)
// // =========================================
// /* In server/controllers/friendController.js */

// // =========================================
// // 2. Get All Friends (FIXED & ROBUST)
// // =========================================
// /* In server/controllers/friendController.js */

// // =========================================
// // 2. Get All Friends (Robust / Fail-Safe)
// // =========================================
// async function getFriends(req, res) {
//   const userId = req.user.userId;

//   // QUERY A: The Advanced Query (With Balances)
//   const settlementQuery = `
//       WITH friend_balances AS (
//         SELECT 
//           cm.friend_id,
//           SUM(
//             COALESCE((SELECT SUM(amount) FROM expenses WHERE payer_member_id = cm.id), 0) - 
//             COALESCE((SELECT SUM(amount_owed) FROM expense_splits WHERE member_id = cm.id), 0)
//           ) as net_amount
//         FROM chapter_members cm
//         WHERE cm.friend_id IS NOT NULL
//         GROUP BY cm.friend_id
//       )
//       SELECT 
//         f.id, f.user_id, f.name, f.username, f.email, f.phone, f.mobile,
//         COALESCE(fb.net_amount * 100, 0)::INTEGER as total_balance
//       FROM friends f
//       LEFT JOIN friend_balances fb ON f.id = fb.friend_id
//       WHERE f.user_id = $1
//       ORDER BY f.name ASC;
//   `;

//   // QUERY B: The Simple Fallback (Just list friends)
//   const simpleQuery = `SELECT * FROM friends WHERE user_id = $1 ORDER BY name ASC`;

//   try {
//     // 1. Try the Advanced Query first
//     const { rows } = await db.query(settlementQuery, [userId]);
//     return res.json({ ok: true, friends: rows });
    
//   } catch (err) {
//     console.warn("⚠️ Settlement Query failed (Likely missing migration). Falling back to simple list.");
//     console.error("SQL Error Details:", err.message);

//     try {
//       // 2. Fallback to Simple Query so the app doesn't crash
//       const { rows } = await db.query(simpleQuery, [userId]);
//       // Return friends with 0 balance so UI still works
//       const friendsWithZero = rows.map(f => ({ ...f, total_balance: 0 }));
//       return res.json({ ok: true, friends: friendsWithZero });
//     } catch (fallbackErr) {
//       console.error("❌ Critical Database Error:", fallbackErr);
//       return res.status(500).json({ ok: false, message: "Server error" });
//     }
//   }
// }

// // =========================================
// // 3. Update Friend
// // =========================================
// async function updateFriend(req, res) {
//   try {
//     const { id } = req.params;
//     const userId = req.user.userId;

//     const result = friendSchema.safeParse(req.body);
//     if (!result.success) {
//       return res.status(400).json({ ok: false, message: result.error.issues[0].message });
//     }

//     const { name, username, email, phone, mobile } = result.data;

//     const cleanName = xss(name);
//     const cleanUsername = xss(username);
//     const cleanEmail = xss(email.toLowerCase());
//     const cleanPhone = xss(phone || "");
//     const cleanMobile = xss(mobile || "");

//     const { rowCount, rows } = await db.query(
//       `UPDATE friends 
//        SET name = $1, username = $2, email = $3, phone = $4, mobile = $5, updated_at = NOW()
//        WHERE id = $6 AND user_id = $7
//        RETURNING *`,
//       [cleanName, cleanUsername, cleanEmail, cleanPhone, cleanMobile, id, userId]
//     );

//     if (rowCount === 0) {
//       return res.status(404).json({ ok: false, message: "Friend not found or unauthorized" });
//     }

//     res.json({ ok: true, message: "Friend updated", friend: rows[0] });

//   } catch (err) {
//     if (err.code === '23505') {
//       return res.status(400).json({ ok: false, message: "You already have a friend with this username." });
//     }
//     console.error("updateFriend error:", err);
//     res.status(500).json({ ok: false, message: "Failed to update friend" });
//   }
// }

// // =========================================
// // 4. Delete Friend
// // =========================================
// async function deleteFriend(req, res) {
//   try {
//     const { id } = req.params;
//     const userId = req.user.userId;

//     const { rowCount } = await db.query(
//       "DELETE FROM friends WHERE id = $1 AND user_id = $2",
//       [id, userId]
//     );

//     if (rowCount === 0) {
//       return res.status(404).json({ ok: false, message: "Friend not found" });
//     }

//     res.json({ ok: true, message: "Friend deleted" });
//   } catch (err) {
//     console.error("deleteFriend error:", err);
//     res.status(500).json({ ok: false, message: "Server error" });
//   }
// }

// // =========================================
// // 5. Get Friend Settlements (NEW)
// // =========================================
// async function getFriendSettlements(req, res) {
//   try {
//     const { friendId } = req.params;
//     const userId = req.user.userId;

//     // 1. Verify this is MY friend
//     const { rows: friendRows } = await db.query(
//       "SELECT id, name FROM friends WHERE id = $1 AND user_id = $2",
//       [friendId, userId]
//     );
//     if (friendRows.length === 0) return res.status(404).json({ ok: false, message: "Friend not found" });
    
//     const friendName = friendRows[0].name;

//     // 2. Find all chapters where this friend is a member (via friend_id link)
//     // We also need the Chapter Name for display
//     const { rows: memberships } = await db.query(
//       `SELECT cm.chapter_id, cm.id as friend_member_id, c.name as chapter_name
//        FROM chapter_members cm
//        JOIN chapters c ON cm.chapter_id = c.id
//        WHERE cm.friend_id = $1`,
//       [friendId]
//     );

//     let grandTotal = 0;
//     const chapterDetails = [];

//     // 3. Iterate through each chapter to calculate settlements
//     for (const ship of memberships) {
//       const { chapter_id, friend_member_id, chapter_name } = ship;

//       // A. Find MY member ID in this chapter
//       const { rows: myMemberRows } = await db.query(
//         "SELECT id FROM chapter_members WHERE chapter_id = $1 AND user_id = $2",
//         [chapter_id, userId]
//       );
      
//       // If I am not in this chapter (rare, but possible), skip
//       if (myMemberRows.length === 0) continue;
//       const myMemberId = myMemberRows[0].id;

//       // B. Calculate Balances for this Chapter (Reusing logic from ExpenseController)
//       const queryText = `
//         WITH spent_cte AS (
//           SELECT payer_member_id, SUM(amount) as total
//           FROM expenses WHERE chapter_id = $1 GROUP BY payer_member_id
//         ),
//         used_cte AS (
//           SELECT es.member_id, SUM(es.amount_owed) as total
//           FROM expense_splits es
//           JOIN expenses e ON es.expense_id = e.id
//           WHERE e.chapter_id = $1
//           GROUP BY es.member_id
//         )
//         SELECT 
//           cm.id, 
//           cm.member_name, 
//           COALESCE(s.total, 0) as total_spent,
//           COALESCE(u.total, 0) as total_used
//         FROM chapter_members cm
//         LEFT JOIN spent_cte s ON cm.id = s.payer_member_id
//         LEFT JOIN used_cte u ON cm.id = u.member_id
//         WHERE cm.chapter_id = $1
//       `;
//       const { rows: balances } = await db.query(queryText, [chapter_id]);
      
//       const formattedBalances = balances.map(b => ({
//         id: b.id,
//         name: b.member_name,
//         balance: parseFloat(b.total_spent) - parseFloat(b.total_used)
//       }));

//       // C. Calculate Settlements
//       const settlements = calculateSettlements(formattedBalances);

//       // D. Find relationship between ME and FRIEND
//       // Scenario 1: I owe Friend (from: Me, to: Friend)
//       // Scenario 2: Friend owes Me (from: Friend, to: Me)
      
//       let amount = 0; // Positive = I get back, Negative = I owe

//       const iOweThem = settlements.find(s => s.fromId === myMemberId && s.toId === friend_member_id);
//       const theyOweMe = settlements.find(s => s.fromId === friend_member_id && s.toId === myMemberId);

//       if (iOweThem) {
//         amount = -parseFloat(iOweThem.amount);
//       } else if (theyOweMe) {
//         amount = parseFloat(theyOweMe.amount);
//       }

//       // Only add to list if there is a non-zero settlement or we want to show all shared chapters
//       chapterDetails.push({
//         chapterId: chapter_id,
//         chapterName: chapter_name,
//         balance: amount
//       });
      
//       grandTotal += amount;
//     }

//     res.json({
//       ok: true,
//       friendName,
//       grandTotal: grandTotal.toFixed(2),
//       chapters: chapterDetails
//     });

//   } catch (err) {
//     console.error("getFriendSettlements error:", err);
//     res.status(500).json({ ok: false, message: "Failed to load settlements" });
//   }
// }

// module.exports = {
//   addFriend,
//   getFriends,
//   updateFriend,
//   deleteFriend,
//   getFriendSettlements // ✅ Export New Function
// };