/* server/utils/jwt.js */
const jwt = require("jsonwebtoken");

const SHORT_AGE = "15d";
const LONG_AGE  = "90d";
const SHORT_MS  = 15 * 24 * 60 * 60 * 1000;
const LONG_MS   = 90 * 24 * 60 * 60 * 1000;

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

function createToken(payload, remember = false) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return jwt.sign(payload, secret, { expiresIn: remember ? LONG_AGE : SHORT_AGE });
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

module.exports = { createToken, sendAuthCookie, clearAuthCookies, SHORT_MS, LONG_MS };