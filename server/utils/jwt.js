/* server/utils/jwt.js */
const jwt = require("jsonwebtoken");

const SHORT_AGE = "1d";
const LONG_AGE = "30d";

const SHORT_MS = 24 * 60 * 60 * 1000;
const LONG_MS = 30 * 24 * 60 * 60 * 1000;

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

  // 1. The Real Security (HttpOnly - Cannot be accessed by JS)
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: isProduction, 
    sameSite: isProduction ? "none" : "lax", 
    maxAge: maxAgeMs,
  });

  // 2. The UI Helper (Readable by JS - For Countdown Timers)
  // ✅ FIX S5: Server-managed expiry timestamp
  res.cookie("session_expiry", Date.now() + maxAgeMs, {
    httpOnly: false, // JS needs to read this
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: maxAgeMs,
  });
}

// ✅ NEW: Helper to clear cookies
function clearAuthCookies(res) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: new Date(0), // Expire immediately
  };

  res.cookie("auth_token", "", cookieOptions);
  
  // Clear the shadow cookie too
  res.cookie("session_expiry", "", { ...cookieOptions, httpOnly: false });
}

module.exports = {
  createToken,
  sendAuthCookie,
  clearAuthCookies, // Exported
  SHORT_MS,
  LONG_MS
};
