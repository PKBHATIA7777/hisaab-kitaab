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

  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: false, // change to true in production with HTTPS
    sameSite: "strict",
    maxAge: maxAgeMs,
  });
}

module.exports = {
  createToken,
  sendAuthCookie,
};
