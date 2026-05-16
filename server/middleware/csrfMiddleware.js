/* server/middleware/csrfMiddleware.js */
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const isProduction = process.env.NODE_ENV === "production";

const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,         // Must be readable by JS for double-submit pattern
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 24 * 60 * 60 * 1000,
  path: "/",
};

/**
 * Derives a stable CSRF token from the user's JWT or session ID.
 * This ensures one token per session — no race condition on parallel requests.
 * If no auth token exists (unauthenticated), falls back to a
 * per-connection token stored in the cookie itself.
 */
function deriveCSRFToken(req) {
  // Strategy 1: Derive from JWT (stable per auth session)
  const authToken = req.cookies.auth_token;
  if (authToken) {
    try {
      // We ONLY decode here (not verify) — we just need the payload's iat/userId
      // to derive a deterministic CSRF token. CSRF is not auth — it binds to session.
      const payload = jwt.decode(authToken);
      if (payload && payload.userId && payload.iat) {
        // HMAC-SHA256 of (userId + iat) using CSRF_SECRET
        // Same inputs always produce same output — zero race condition
        const secret = process.env.CSRF_SECRET || process.env.JWT_SECRET;
        return crypto
          .createHmac("sha256", secret)
          .update(`${payload.userId}:${payload.iat}`)
          .digest("hex");
      }
    } catch (_) { /* fall through */ }
  }

  // Strategy 2: Unauthenticated session — use existing cookie token or generate once
  const existingToken = req.cookies.csrf_token;
  if (existingToken && existingToken.length >= 64) {
    return existingToken; // Stable — don't regenerate
  }

  // Strategy 3: First visit — generate and this becomes stable via cookie
  return crypto.randomBytes(32).toString("hex");
}

function csrfProtection(req, res, next) {
  const token = deriveCSRFToken(req);

  // Always refresh the cookie TTL (combats iOS ITP 7-day eviction)
  // but the VALUE is always the same for the same auth session
  res.cookie("csrf_token", token, CSRF_COOKIE_OPTIONS);

  // Echo in response header so frontend can capture it without
  // an extra round-trip (critical for the first-request cold path)
  res.setHeader("X-CSRF-Token", token);

  // Only validate on mutations
  const method = req.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return next();
  }

  const headerToken = req.headers["x-csrf-token"];

  if (!headerToken || headerToken !== token) {
    return res.status(403).json({
      ok: false,
      message: "Security check failed. Please refresh the page.",
      csrfError: true,
    });
  }

  next();
}

module.exports = csrfProtection;