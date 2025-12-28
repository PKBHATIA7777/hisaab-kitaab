/* server/utils/jwt.js */
const jwt = require("jsonwebtoken");

const SHORT_AGE = "15d"; // Increased from 1d
const LONG_AGE = "90d";  // Increased from 30d (Standard for apps)

const SHORT_MS = 15 * 24 * 60 * 60 * 1000;
const LONG_MS = 90 * 24 * 60 * 60 * 1000;

function createToken(payload, remember = false) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");

  return jwt.sign(payload, secret, { 
    expiresIn: remember ? LONG_AGE : SHORT_AGE 
  });
}

function sendAuthCookie(res, token, remember = false) {
  const maxAgeMs = remember ? LONG_MS : SHORT_MS;
  const isProduction = process.env.NODE_ENV === "production";

  // ✅ FIX: Force Secure/None to match CSRF middleware (Works on localhost & 127.0.0.1)
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: true,        // changed from isProduction
    sameSite: "none",    // changed from isProduction ? "none" : "lax"
    maxAge: maxAgeMs,
  });

  // ✅ FIX: Apply same settings to the shadow cookie
  res.cookie("session_expiry", Date.now() + maxAgeMs, {
    httpOnly: false,
    secure: true,        // changed from isProduction
    sameSite: "none",    // changed from isProduction ? "none" : "lax"
    maxAge: maxAgeMs,
  });
}

// ✅ NEW: Helper to clear cookies
function clearAuthCookies(res) {
  const cookieOptions = {
    httpOnly: true,
    secure: true,        // Match the setting above
    sameSite: "none",    // Match the setting above
    expires: new Date(0), 
  };

  res.cookie("auth_token", "", cookieOptions);
  res.cookie("session_expiry", "", { ...cookieOptions, httpOnly: false });
}

module.exports = {
  createToken,
  sendAuthCookie,
  clearAuthCookies, 
  SHORT_MS,
  LONG_MS
};
