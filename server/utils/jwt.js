const jwt = require("jsonwebtoken");

function createToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET not set in .env");
  }

  // expires in 5 days
  return jwt.sign(payload, secret, { expiresIn: "5d" });
}

function sendAuthCookie(res, token) {
  // 5 days in ms
  const maxAgeMs = 5 * 24 * 60 * 60 * 1000;

  // CHECK: Are we in production?
  // Render sets NODE_ENV to 'production' automatically.
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("auth_token", token, {
    httpOnly: true,
    // VITAL for Vercel->Render communication:
    secure: isProduction, // Must be TRUE on HTTPS (Production)
    sameSite: isProduction ? "none" : "lax", // Must be NONE for Cross-Site
    maxAge: maxAgeMs,
  });
}

module.exports = {
  createToken,
  sendAuthCookie,
};