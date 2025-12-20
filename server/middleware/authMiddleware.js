/* server/middleware/authMiddleware.js */
const jwt = require("jsonwebtoken");
const db = require("../config/db");

async function requireAuth(req, res, next) {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ ok: false, message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // 1. DATABASE CHECK: Ensure user actually exists
    // We also fetch 'updated_at' to invalidate old tokens after password changes
    const { rows } = await db.query(
      "SELECT id, updated_at FROM users WHERE id = $1", 
      [payload.userId]
    );
    const user = rows[0];

    if (!user) {
      // User deleted or invalid ID
      return res.status(401).json({ ok: false, message: "User account no longer exists" });
    }

    // 2. STALENESS CHECK: Invalidate token if password/account changed recently
    // payload.iat is in Seconds. user.updated_at is a Date object (milliseconds).
    // We add a 2-second buffer to 'iat' to allow for server processing time during login.
    if (user.updated_at) {
      const lastUpdateTimestamp = new Date(user.updated_at).getTime() / 1000; // to seconds
      const tokenIssuedAt = payload.iat;

      if (lastUpdateTimestamp > (tokenIssuedAt + 2)) {
         return res.status(401).json({ 
           ok: false, 
           message: "Session expired due to password change. Please login again." 
         });
      }
    }

    req.user = payload; 
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };