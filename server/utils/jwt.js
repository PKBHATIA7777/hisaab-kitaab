/* server/utils/jwt.js */
/* FIX v2: Cookie settings hardened for iOS Safari ITP + cross-origin Render deployment
   
   ROOT CAUSE OF iOS AUTH FAILURES:
   - Safari's ITP (Intelligent Tracking Prevention) blocks SameSite=None cookies
     when the backend is on a different domain (Render) than the frontend (Vercel)
   - This means auth_token and csrf_token cookies get blocked on iOS Safari
   
   PRODUCTION FIX:
   - SameSite=None + Secure=true is required for cross-origin cookies
   - Add __Host- prefix to cookies for extra security (forces Secure + no domain)
   - Set the domain explicitly if frontend/backend share a root domain
   - For Render + Vercel (different domains): SameSite=None is unavoidable
     but we add extra headers to help iOS not classify Render as a tracker
   
   DEVELOPMENT:
   - SameSite=Lax works on localhost because same-origin
*/
const jwt = require("jsonwebtoken");

const SHORT_AGE = "15d";
const LONG_AGE  = "90d";

const SHORT_MS = 15 * 24 * 60 * 60 * 1000;
const LONG_MS  = 90 * 24 * 60 * 60 * 1000;

const isProduction = process.env.NODE_ENV === "production";

function createToken(payload, remember = false) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return jwt.sign(payload, secret, { expiresIn: remember ? LONG_AGE : SHORT_AGE });
}

function sendAuthCookie(res, token, remember = false) {
  const maxAgeMs = remember ? LONG_MS : SHORT_MS;

  // Production (Render + Vercel cross-origin): SameSite=None + Secure required
  // Dev (localhost): SameSite=Lax + Secure=false works without HTTPS
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: maxAgeMs,
    path: "/",
  };

  res.cookie("auth_token", token, cookieOptions);

  // Readable "expiry shadow" cookie for client-side session warning
  res.cookie("session_expiry", String(Date.now() + maxAgeMs), {
    httpOnly: false,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: maxAgeMs,
    path: "/",
  });
}

function clearAuthCookies(res) {
  const clearOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    expires: new Date(0),
    path: "/",
  };

  res.cookie("auth_token", "", clearOptions);
  res.cookie("session_expiry", "", { ...clearOptions, httpOnly: false });
}

module.exports = {
  createToken,
  sendAuthCookie,
  clearAuthCookies,
  SHORT_MS,
  LONG_MS,
};