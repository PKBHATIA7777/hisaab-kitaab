/* server/middleware/csrfMiddleware.js */
const crypto = require("crypto");

function csrfProtection(req, res, next) {
  if (!req.cookies.csrf_token) {
    const token = crypto.randomUUID();
    res.cookie("csrf_token", token, {
      httpOnly: false, 
      secure: true, 
      sameSite: "none", 
      maxAge: 24 * 60 * 60 * 1000 
    });
    req.cookies.csrf_token = token;
  }

  const method = req.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const headerToken = req.headers["x-csrf-token"];
    const cookieToken = req.cookies.csrf_token;

    if (!headerToken || headerToken !== cookieToken) {
      // ✅ FIX: Removed sensitive 'cookies' log. Only log safe metadata.
      console.error("CSRF Blocked:", { 
        method,
        url: req.originalUrl,
        ip: req.ip,
        origin: req.headers.origin || "Unknown"
      });
      
      return res.status(403).json({
        ok: false,
        message: "Security check failed (CSRF). Please refresh the page."
      });
    }
  }

  next();
}

module.exports = csrfProtection;