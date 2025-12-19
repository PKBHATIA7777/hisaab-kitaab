/* server/utils/jwt.js */
const jwt = require("jsonwebtoken");

// Default: 1 day. Remember Me: 30 days.
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

  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: maxAgeMs,
  });
}

module.exports = {
  createToken,
  sendAuthCookie,
  SHORT_MS, // Exported for use in controller
  LONG_MS
};
