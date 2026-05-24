/* server/middleware/authMiddleware.js */
const jwt = require("jsonwebtoken");
const db = require("../config/db");

// In-memory cache to avoid DB hit on every request for the same user.
// Key: userId, Value: { updatedAt: timestamp, jwtGeneration: number, cachedAt: Date.now() }
// TTL: 60 seconds — short enough to catch password changes quickly.
const userCache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

function getCachedUser(userId) {
  const entry = userCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL) {
    userCache.delete(userId);
    return null;
  }
  return entry;
}

// Evict oldest entries when cache grows too large
function pruneCache() {
  if (userCache.size < 1000) return;
  const now = Date.now();
  for (const [key, val] of userCache) {
    if (now - val.cachedAt > CACHE_TTL) userCache.delete(key);
  }
}

async function requireAuth(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ ok: false, message: "Authentication required" });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Invalid or expired session" });
  }

  const userId = payload.userId;

  // Try cache first
  let userData = getCachedUser(userId);

  // NEW — replace the entire DB query block and staleness check:
  if (!userData) {
    try {
      const { rows } = await db.query(
        "SELECT id, updated_at, jwt_generation FROM users WHERE id = $1",
        [userId]
      );
      if (!rows[0]) {
        return res.status(401).json({ ok: false, message: "Account not found" });
      }
      userData = {
        updatedAt: rows[0].updated_at,
        jwtGeneration: rows[0].jwt_generation,
        cachedAt: Date.now()
      };
      userCache.set(userId, userData);
      pruneCache();
    } catch (err) {
      // AUTH-08 FIX: Fail closed on DB error.
      // Failing open would allow revoked sessions (post-logout, post-password-change)
      // to remain valid during a DB outage. A brief 503 is the safer trade-off.
      console.error("requireAuth DB error:", err.message);
      return res.status(503).json({
        ok: false,
        message: "Service temporarily unavailable. Please try again in a moment.",
      });
    }
  }

  // Generation check (primary revocation mechanism)
  if (payload.gen !== undefined && payload.gen !== userData.jwtGeneration) {
    userCache.delete(userId);
    return res.status(401).json({
      ok: false,
      message: "Session has been revoked. Please log in again.",
    });
  }

  // Staleness check (secondary — for password changes on old tokens without gen)
  if (userData.updatedAt) {
    const lastUpdateSec = new Date(userData.updatedAt).getTime() / 1000;
    // 5-second buffer for clock skew between login and cookie write
    if (lastUpdateSec > payload.iat + 5) {
      userCache.delete(userId);
      return res.status(401).json({
        ok: false,
        message: "Session expired. Please log in again.",
      });
    }
  }

  req.user = payload;
  next();
}

// Export cache invalidation so authController can call it after password change
function invalidateUserCache(userId) {
  userCache.delete(String(userId));
}

module.exports = { requireAuth, invalidateUserCache };