/* server/utils/jwt.js */
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const SHORT_AGE = "15d";
const LONG_AGE  = "90d";
const SHORT_MS  = 15 * 24 * 60 * 60 * 1000;
const LONG_MS   = 90 * 24 * 60 * 60 * 1000;

// Refresh token configuration
const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_TTL_DAYS = 90;

const isProduction = process.env.NODE_ENV === "production";

// Single source of truth for all cookie options
function getCookieOptions(maxAgeMs, httpOnly = true) {
  const opts = {
    httpOnly,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: maxAgeMs,
    path: "/",
  };
  // NEVER set domain for cross-origin Vercel→Render setup.
  // Setting domain to .onrender.com would break cross-origin cookies entirely.
  // Leave domain undefined so the browser sets it to the exact request host.
  return opts;
}

// MODIFY createToken to embed generation:
// payload must include { userId, gen } — gen is jwt_generation from DB
function createToken(payload, remember = false) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  // payload must include { userId, gen } — gen is jwt_generation from DB
  return jwt.sign(payload, secret, { expiresIn: remember ? LONG_AGE : SHORT_AGE });
}

// ADD new utility: Increment JWT generation for token revocation
async function incrementJwtGeneration(userId, dbClient) {
  const q = dbClient || require("../config/db");
  const { rows } = await q.query(
    `UPDATE users SET jwt_generation = jwt_generation + 1, updated_at = NOW()
     WHERE id = $1 RETURNING jwt_generation`,
    [userId]
  );
  return rows[0]?.jwt_generation;
}

// ── REFRESH TOKEN UTILITIES ──────────────────────────────────

function generateRefreshToken() {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function issueRefreshToken(db, userId, deviceHint = "") {
  const raw = generateRefreshToken();
  const hash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_hint, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token_hash) DO NOTHING`,
    [userId, hash, deviceHint.slice(0, 255), expiresAt]
  );

  return raw; // Return raw — never store raw in DB
}

async function rotateRefreshToken(db, rawToken, userId) {
  const hash = hashRefreshToken(rawToken);
  const { rows } = await db.query(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1 AND user_id = $2
       AND revoked = FALSE AND expires_at > NOW()`,
    [hash, userId]
  );

  if (!rows[0]) return null;

  // Revoke old token
  await db.query("UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1", [rows[0].id]);

  // Issue new token (rotation — limits stolen token window)
  return issueRefreshToken(db, userId, rows[0].device_hint);
}

async function revokeAllRefreshTokens(db, userId) {
  await db.query(
    "UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1",
    [userId]
  );
}

function sendAuthCookie(res, token, remember = false) {
  const maxAgeMs = remember ? LONG_MS : SHORT_MS;
  res.cookie("auth_token", token, getCookieOptions(maxAgeMs, true));
  // session_expiry is intentionally httpOnly:false so JS can read it for the
  // "session expiring soon" warning. But we keep all other options identical
  // so iOS ITP treats it the same as the auth cookie.
  res.cookie("session_expiry", String(Date.now() + maxAgeMs), getCookieOptions(maxAgeMs, false));
}

function clearAuthCookies(res) {
  const expiredOptions = {
    ...getCookieOptions(0, true),
    expires: new Date(0),
    maxAge: 0,
  };
  res.cookie("auth_token",    "", expiredOptions);
  res.cookie("session_expiry","", { ...expiredOptions, httpOnly: false });
  // Also clear CSRF token so next login gets a fresh one
  res.cookie("csrf_token",    "", { ...expiredOptions, httpOnly: false });
}

module.exports = {
  createToken, sendAuthCookie, clearAuthCookies, SHORT_MS, LONG_MS,
  incrementJwtGeneration, issueRefreshToken, rotateRefreshToken,
  revokeAllRefreshTokens, hashRefreshToken, generateRefreshToken
};