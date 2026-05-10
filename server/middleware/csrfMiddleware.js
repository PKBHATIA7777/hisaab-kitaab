/* server/middleware/csrfMiddleware.js */
const crypto = require("crypto");

const isProduction = process.env.NODE_ENV === "production";

const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,             // Must be readable by JS
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 24 * 60 * 60 * 1000,
  path: "/",
};

function csrfProtection(req, res, next) {
  // Step 1: Ensure cookie exists. Regenerate if missing or suspiciously short.
  let token = req.cookies.csrf_token;
  if (!token || token.length < 32) {
    token = crypto.randomUUID();
    res.cookie("csrf_token", token, CSRF_COOKIE_OPTIONS);
  }
  req.csrf_token = token;

  // Step 2: Always echo the current token back in a response header so the
  // frontend can update its in-memory copy without a round-trip.
  // This fixes the "stale token after logout" race condition.
  res.setHeader("X-CSRF-Token", token);

  // Step 3: Only validate on mutation methods
  const method = req.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return next();
  }

  const headerToken = req.headers["x-csrf-token"];
  const cookieToken = req.cookies.csrf_token;

  // Both must be present and match
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({
      ok: false,
      message: "Security check failed. Please refresh the page and try again.",
      csrfError: true,  // Flag so frontend can auto-refresh the token and retry once
    });
  }

  next();
}

module.exports = csrfProtection;