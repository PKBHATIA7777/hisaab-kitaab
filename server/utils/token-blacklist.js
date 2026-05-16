/* server/utils/token-blacklist.js */
/**
 * Lightweight in-memory token blacklist for immediate revocation
 * (generation counter handles persistent revocation across restarts)
 * This handles the window between logout and cache TTL expiry.
 */
const blacklist = new Set();
const TTL_MAP = new Map(); // token_jti → expiry timestamp

function add(jti, expiresAt) {
  blacklist.add(jti);
  TTL_MAP.set(jti, expiresAt);
}

function isBlacklisted(jti) {
  if (!jti) return false;
  const expiry = TTL_MAP.get(jti);
  if (expiry && Date.now() > expiry * 1000) {
    // Token expired naturally — clean up
    blacklist.delete(jti);
    TTL_MAP.delete(jti);
    return false;
  }
  return blacklist.has(jti);
}

// Cleanup expired entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiry] of TTL_MAP.entries()) {
    if (now > expiry * 1000) {
      blacklist.delete(jti);
      TTL_MAP.delete(jti);
    }
  }
}, 30 * 60 * 1000);

module.exports = { add, isBlacklisted };