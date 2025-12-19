// ✅ COMPLETE server/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ ok: false, message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // Attaches user info to the request
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };