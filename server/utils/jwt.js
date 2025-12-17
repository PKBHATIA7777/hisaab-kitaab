const jwt = require("jsonwebtoken");

function createToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET not set in .env");
  }

  // ✅ SECURITY UPDATE: Token now expires in 1 day (was 5 days)
  return jwt.sign(payload, secret, { expiresIn: "1d" });
}

function sendAuthCookie(res, token) {
  // ✅ SECURITY UPDATE: Max age matches token (1 day in milliseconds)
  const maxAgeMs = 24 * 60 * 60 * 1000;

  // CHECK: Are we in production?
  // Render sets NODE_ENV to 'production' automatically.
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("auth_token", token, {
    httpOnly: true, // Prevents JavaScript from reading the cookie (XSS protection)
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