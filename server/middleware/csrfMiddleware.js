/* server/middleware/csrfMiddleware.js */
/* FIX v2: Match cookie settings with jwt.js for iOS Safari compatibility
   
   CSRF cookie must use SAME sameSite/secure settings as auth cookie.
   Mismatch was causing iOS Safari to accept auth cookie but block CSRF cookie,
   making ALL write operations (POST/PUT/DELETE/PATCH) fail with 403 on iPhone.
*/
const crypto = require("crypto");

const isProduction = process.env.NODE_ENV === "production";

function csrfProtection(req, res, next) {
  if (!req.cookies.csrf_token) {
    const token = crypto.randomUUID();
    res.cookie("csrf_token", token, {
      httpOnly: false,                              // Must be readable by JS
      secure: isProduction,                         // HTTPS only in prod
      sameSite: isProduction ? "none" : "lax",     // Match jwt.js setting
      maxAge: 24 * 60 * 60 * 1000,                 // 24 hours
      path: "/",
    });
    req.cookies.csrf_token = token;
  }

  req.csrf_token = req.cookies.csrf_token;

  const method = req.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return next();
  }

  const headerToken = req.headers["x-csrf-token"];
  const cookieToken = req.cookies.csrf_token;

  if (!headerToken || !cookieToken) {
    return res.status(403).json({
      ok: false,
      message: "Security check failed (CSRF token missing). Please refresh the page.",
    });
  }

  if (headerToken !== cookieToken) {
    return res.status(403).json({
      ok: false,
      message: "Security check failed (CSRF mismatch). Please refresh the page.",
    });
  }

  next();
}

module.exports = csrfProtection;