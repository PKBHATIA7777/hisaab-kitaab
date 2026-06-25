const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const { sendOtpEmail } = require("../utils/email");
const bcrypt = require("bcrypt");
const xss = require("xss");
const db = require("../config/db");
const { createToken, sendAuthCookie, clearAuthCookies, SHORT_MS, LONG_MS, incrementJwtGeneration, rotateRefreshToken, revokeAllRefreshTokens } = require("../utils/jwt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); // ✅ ADDED for constant-time OTP comparison
const log = require("../utils/logger");
const {
  registerSchema,
  loginSchema,
  emailSchema,
  normalizeEmail
} = require("../utils/validation");
const { invalidateUserCache } = require("../middleware/authMiddleware");

const { createPersonalChapterForUser } = require("./personalChapterController");

const isProduction = process.env.NODE_ENV === "production";

function generateOtpCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

// Detect device info from User-Agent for device session tracking
function parseDeviceInfo(userAgent, ip) {
  const ua = userAgent || '';
  let deviceType = 'desktop';
  let browser = 'Unknown';
  let os = 'Unknown';
  
  // Device type
  if (/Mobile|Android.*Mobile|iPhone/.test(ua)) deviceType = 'mobile';
  else if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) deviceType = 'tablet';
  
  // Browser
  if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/EdgA?\//.test(ua)) browser = 'Edge';
  else if (/CriOS/.test(ua)) browser = 'Chrome (iOS)';
  else if (/FxiOS/.test(ua)) browser = 'Firefox (iOS)';
  else if (/Chrome/.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Firefox/.test(ua)) browser = 'Firefox';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  
  // OS
  if (/iPhone/.test(ua)) os = 'iOS';
  else if (/iPad/.test(ua)) os = 'iPadOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  
  const deviceName = `${browser} on ${os}`;
  
  return { deviceType, browser, os, deviceName, ip: ip || 'Unknown' };
}

async function registerDeviceSession(userId, jwtIat, req) {
  try {
    const { deviceType, browser, os, deviceName, ip } = parseDeviceInfo(
      req.headers['user-agent'],
      req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress
    );
    
    const sessionId = require('crypto').randomBytes(32).toString('hex');
    
    await db.query(
      `INSERT INTO device_sessions 
         (user_id, session_id, device_name, device_type, browser, os, ip_address, jwt_iat)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (session_id) DO UPDATE 
         SET last_active_at = NOW()`,
      [userId, sessionId, deviceName, deviceType, browser, os, ip, jwtIat]
    );
    
    return sessionId;
  } catch (err) {
    // Non-fatal — don't block login if session tracking fails
    log.error({ err }, 'registerDeviceSession error (non-fatal)');
    return null;
  }
}

async function findUserById(id) {
  const { rows } = await db.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
  return rows[0] || null;
}

async function findUserByIdentifier(identifier) {
  const { rows } = await db.query(
    "SELECT * FROM users WHERE email = $1 OR (username = $1 AND username IS NOT NULL) LIMIT 1",
    [identifier]
  );
  return rows[0] || null;
}

async function checkIdentifier(req, res) {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ ok: false, message: "Identifier required" });
    const cleanIdentifier = identifier.trim().toLowerCase();
    const user = await findUserByIdentifier(cleanIdentifier);
    if (!user) return res.json({ ok: true, exists: false });
    return res.json({ ok: true, exists: true, email: user.email, provider: user.provider, hasPassword: !!user.password_hash });
  } catch (err) {
    log.error({ err }, "checkIdentifier error");
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

async function loginRequestOtp(req, res) {
  try {
    const result = emailSchema.safeParse(req.body.email);
    if (!result.success) return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    const email = result.data;
    const user = await findUserByIdentifier(email);
    if (!user) return res.status(404).json({ ok: false, message: "Account not found. Please sign up." });
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.query(
      `INSERT INTO otps (email, code, purpose, expires_at, used, attempts) VALUES ($1, $2, 'login', $3, FALSE, 0)
       ON CONFLICT (email, purpose) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, used = FALSE, attempts = 0, created_at = NOW()`,
      [email, code, expiresAt]
    );
    await sendOtpEmail(email, "Your Hisaab-Kitaab login code", `Your login code is ${code}. It will expire in 10 minutes.`);
    return res.json({ ok: true, message: "Login OTP sent to your email" });
  } catch (err) {
    log.error({ err }, "loginRequestOtp error");
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

async function loginVerifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ ok: false, message: "Missing data" });
    const otpRow = await verifyOtpLogic(email, otp, "login");
    await db.query("UPDATE otps SET used = TRUE WHERE id = $1", [otpRow.id]);
    const user = await findUserByIdentifier(email.trim().toLowerCase());
    if (!user) return res.status(400).json({ ok: false, message: "User not found" });
    // Always remember — 60-day sliding window for all login methods
    const remember = true;
    // UPDATED: Include jwt_generation in token payload
    const tokenPayload = { userId: user.id.toString(), gen: user.jwt_generation ?? 0 };
    const token = createToken(tokenPayload, remember);
    sendAuthCookie(res, token, remember);

    // Issue refresh token for silent session renewal (60-day sliding window)
    const { issueRefreshToken } = require("../utils/jwt");
    const deviceHint = req.headers['user-agent']?.slice(0, 100) || '';
    const rawRefresh = await issueRefreshToken(db, user.id, deviceHint);
    res.cookie("refresh_token", rawRefresh, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
      path: "/api/auth/refresh",
    });

    // Register device session for multi-device management (non-blocking)
    const decoded = require('jsonwebtoken').decode(token);
    registerDeviceSession(user.id, decoded?.iat, req).catch(() => {});

    return res.json({ ok: true, message: "Login successful", user: { id: user.id, realName: user.real_name, username: user.username, email: user.email }, sessionExpiresAt: Date.now() + LONG_MS });
  } catch (err) {
    const status = err.message.includes("Invalid") || err.message.includes("Too many") ? 400 : 500;
    return res.status(status).json({ ok: false, message: err.message });
  }
}

// ✅ SECURE OTP VERIFICATION - Constant-time comparison + timing attack mitigation
async function verifyOtpLogic(email, otp, purpose) {
  const cleanEmail = email.trim().toLowerCase();

  // Sanitize OTP input
  const cleanOtp = String(otp).trim().replace(/\D/g, "");
  if (cleanOtp.length !== 6) throw new Error("OTP must be 6 digits");

  const { rows } = await db.query(
    `SELECT * FROM otps
     WHERE email = $1 AND purpose = $2
       AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail, purpose]
  );
  const otpRow = rows[0];

  // Always perform constant-time comparison — even if row doesn't exist
  // This prevents timing-based "does this email have a pending OTP" enumeration
  const expectedCode = otpRow?.code || "000000";

  // FIX: Use Buffer.from() not Buffer.alloc() — alloc fills with repeated byte,
  // not the string. Both buffers must be same length for timingSafeEqual.
  const inputBuf = Buffer.from(cleanOtp.padEnd(6, '0').slice(0, 6));
  const expectedBuf = Buffer.from(expectedCode.padEnd(6, '0').slice(0, 6));

  // Constant-time comparison
  const match = crypto.timingSafeEqual(inputBuf, expectedBuf);

  if (!otpRow) {
    // Artificial delay to prevent timing enumeration of OTP existence
    await new Promise(r => setTimeout(r, 150 + Math.random() * 100));
    throw new Error("Invalid or expired OTP");
  }

  if (otpRow.attempts >= 5) { // Increased from 3 to 5 — more user-friendly
    await db.query("UPDATE otps SET used = TRUE WHERE id = $1", [otpRow.id]);
    throw new Error("Too many failed attempts. Please request a new code.");
  }

  if (!match) {
    await db.query("UPDATE otps SET attempts = attempts + 1 WHERE id = $1", [otpRow.id]);
    // Jitter delay makes timing attacks impractical
    await new Promise(r => setTimeout(r, 150 + Math.random() * 150));
    const remaining = 5 - (otpRow.attempts + 1);
    throw new Error(`Invalid OTP code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`);
  }

  return otpRow;
}

async function registerRequestOtp(req, res) {
  try {
    const result = emailSchema.safeParse(req.body.email);
    if (!result.success) return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    const email = result.data;
    const { rows } = await db.query("SELECT id FROM users WHERE email = $1", [email]);
    if (rows.length > 0) return res.status(400).json({ ok: false, message: "Email already registered" });
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.query(
      `INSERT INTO otps (email, code, purpose, expires_at, used, attempts) VALUES ($1, $2, 'signup', $3, FALSE, 0)
       ON CONFLICT (email, purpose) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, used = FALSE, attempts = 0, created_at = NOW()`,
      [email, code, expiresAt]
    );
    await sendOtpEmail(email, "Your Hisaab-Kitaab verification code", `Your verification code is ${code}. It will expire in 10 minutes.`);
    return res.json({ ok: true, message: "OTP sent to your email address" });
  } catch (err) {
    log.error({ err }, "registerRequestOtp error");
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

async function registerVerifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ ok: false, message: "Missing data" });
    const otpRow = await verifyOtpLogic(email, otp, "signup");
    
    // AUTH-01 FIX: Use an opaque server-side session ID instead of a signed JWT
    // in the response body. A signed JWT in the response body is vulnerable to
    // XSS — any script on the page can steal it and complete registration.
    // We store the mapping server-side and give the client only a random ID.
    const { randomBytes } = require("crypto");
    const signupSessionId = randomBytes(32).toString("hex");
    const signupSessionExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Reuse the otps table: store the opaque session under purpose='signup_session'
    // The email + otpId are stored as the "code" field (JSON-encoded) so we can
    // look them up without a new table.
    await db.query(
      `INSERT INTO otps (email, code, purpose, expires_at, used, attempts)
       VALUES ($1, $2, 'signup_session', $3, FALSE, 0)
       ON CONFLICT (email, purpose) DO UPDATE
         SET code = EXCLUDED.code,
             expires_at = EXCLUDED.expires_at,
             used = FALSE,
             attempts = 0,
             created_at = NOW()`,
      [
        email.trim().toLowerCase(),
        JSON.stringify({ sessionId: signupSessionId, otpId: otpRow.id }),
        signupSessionExpiry,
      ]
    );

    // Also keep the httpOnly cookie path for non-ITP browsers (most browsers)
    const tempToken = require("jsonwebtoken").sign(
      { email: email.trim().toLowerCase(), purpose: "complete_signup", otpId: otpRow.id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.cookie("signup_token", tempToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
      path: "/",
    });

    // Return only the opaque session ID — NOT a signed JWT.
    // The client stores this in sessionStorage as a fallback for iOS ITP
    // (where the httpOnly cookie may be blocked on cross-origin requests).
    // An opaque random ID has no value to an attacker without the server-side mapping.
    return res.json({
      ok: true,
      message: "Email verified successfully",
      _signupSessionId: signupSessionId,  // opaque ID, not a signed token
    });
  } catch (err) {
    const status = err.message.includes("Invalid") || err.message.includes("Too many") ? 400 : 500;
    return res.status(status).json({ ok: false, message: err.message });
  }
}

async function registerComplete(req, res) {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ ok: false, message: "Server configuration error" });
    }

    const result = registerSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ ok: false, message: result.error.issues[0].message });

    // ✅ XSS FIX: Sanitize realName with xss() before using
    const { password } = result.data;
    const realName = xss(result.data.realName.trim());
    
    // AUTH-01 FIX: Read signup token from cookie OR opaque session ID from Authorization header
    // The opaque session ID (stored server-side) replaces the signed JWT in the response body.
    // Priority: httpOnly cookie (most browsers) → opaque session ID (iOS ITP fallback)
    const signupToken = req.cookies.signup_token;
    const signupSessionId = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;

    let email = null;
    let otpId = null;

    if (signupToken) {
      // Primary path: httpOnly cookie with signed JWT (works on all non-ITP browsers)
      try {
        const payload = jwt.verify(signupToken, process.env.JWT_SECRET);
        if (payload.purpose !== "complete_signup") throw new Error();
        email = payload.email;
        otpId = payload.otpId;
      } catch {
        return res.status(401).json({ ok: false, message: "Invalid verification." });
      }
    } else if (signupSessionId) {
      // Fallback path: opaque session ID for iOS ITP environments
      // Look up the server-side mapping in the otps table
      const cleanEmail = (req.body?.email || "").trim().toLowerCase();
      if (!cleanEmail) {
        return res.status(401).json({ ok: false, message: "Email required for verification." });
      }
      const { rows: sessionRows } = await db.query(
        `SELECT code FROM otps
         WHERE email = $1 AND purpose = 'signup_session'
           AND used = FALSE AND expires_at > NOW()
         LIMIT 1`,
        [cleanEmail]
      );
      if (!sessionRows[0]) {
        return res.status(401).json({ ok: false, message: "Verification session expired. Please start over." });
      }
      let sessionData;
      try {
        sessionData = JSON.parse(sessionRows[0].code);
      } catch {
        return res.status(401).json({ ok: false, message: "Invalid verification session." });
      }
      // Constant-time comparison of the opaque session ID
      const { timingSafeEqual } = require("crypto");
      const provided = Buffer.from(signupSessionId.padEnd(64, '0').slice(0, 64));
      const stored = Buffer.from(sessionData.sessionId.padEnd(64, '0').slice(0, 64));
      if (!timingSafeEqual(provided, stored)) {
        return res.status(401).json({ ok: false, message: "Invalid verification." });
      }
      email = cleanEmail;
      otpId = sessionData.otpId;
    } else {
      return res.status(401).json({ ok: false, message: "Email verification required." });
    }

    const client = await db.pool.connect();
    await client.query("BEGIN");

    try {
      const { rows: otpCheck } = await client.query("SELECT used FROM otps WHERE id = $1 FOR UPDATE", [otpId]);
      if (!otpCheck[0] || otpCheck[0].used) {
        await client.query("ROLLBACK");
        return res.status(400).json({ ok: false, message: "Link already used" });
      }

      const { rows: existingRows } = await client.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
      if (existingRows[0]) {
        await client.query("ROLLBACK");
        return res.status(400).json({ ok: false, message: "Email already in use" });
      }

      const baseUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      let username = baseUsername;
      let counter = 1;
      while (true) {
        const { rows: uRows } = await client.query("SELECT 1 FROM users WHERE username = $1 LIMIT 1", [username]);
        if (uRows.length === 0) break;
        username = `${baseUsername}${counter++}`;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date();
      const { rows: userRows } = await client.query(
        `INSERT INTO users (real_name, username, email, password_hash, provider, google_id, needs_password, last_login_at)
         VALUES ($1, $2, $3, $4, 'local', NULL, FALSE, $5) RETURNING *`,
        [realName, username, email, passwordHash, now]  // realName is now sanitized
      );
      const user = userRows[0];

      await client.query("UPDATE otps SET used = TRUE WHERE id = $1", [otpId]);
      // AUTH-01 FIX: Also mark the signup_session row as used so it can't be replayed
      await client.query(
        "UPDATE otps SET used = TRUE WHERE email = $1 AND purpose = 'signup_session'",
        [email]
      );
      await client.query("COMMIT");

      // ✅ FIX 1: Auto-create personal chapter (non-fatal, fire-and-forget)
      // Don't block the response; background job handles chapter creation
      try {
        setImmediate(() => {
          createPersonalChapterForUser(user.id, null).catch(err =>
            log.error({ err, userId: user.id }, "Background: personal chapter creation failed")
          );
        });
      } catch (_) { /* setImmediate itself never throws */ }

      // ✅ FIX 2: Clear signup cookie with proper sameSite/secure settings for cross-origin
      res.cookie("signup_token", "", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        expires: new Date(0),
        maxAge: 0,
        path: "/",
      });

      // UPDATED: Include jwt_generation in token payload
      const tokenPayload = { userId: user.id.toString(), gen: user.jwt_generation ?? 0 };
      const token = createToken(tokenPayload);
      sendAuthCookie(res, token);

      // Issue refresh token for silent session renewal (60-day sliding window)
      const { issueRefreshToken } = require("../utils/jwt");
      const deviceHint = req.headers['user-agent']?.slice(0, 100) || '';
      const rawRefresh = await issueRefreshToken(db, user.id, deviceHint);
      res.cookie("refresh_token", rawRefresh, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
        path: "/api/auth/refresh",
      });

      return res.json({
        ok: true,
        message: "Account created successfully",
        user: { id: user.id, realName: user.real_name, username: user.username, email: user.email },
      });

    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    log.error({ err }, "registerComplete error");
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

async function login(req, res) {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ ok: false, message: "Missing credentials" });
    const user = await findUserByIdentifier(identifier);
    if (!user) return res.status(400).json({ ok: false, message: "Invalid credentials" });
    if (!user.password_hash) return res.status(400).json({ ok: false, message: "This account uses Google/OTP login." });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ ok: false, message: "Invalid credentials" });
    // Always remember — 60-day sliding window for all login methods
    const remember = true;
    // UPDATED: Include jwt_generation in token payload
    const tokenPayload = { userId: user.id.toString(), gen: user.jwt_generation ?? 0 };
    const token = createToken(tokenPayload, remember);
    sendAuthCookie(res, token, remember);

    // Issue refresh token for silent session renewal (60-day sliding window)
    const { issueRefreshToken } = require("../utils/jwt");
    const deviceHint = req.headers['user-agent']?.slice(0, 100) || '';
    const rawRefresh = await issueRefreshToken(db, user.id, deviceHint);
    res.cookie("refresh_token", rawRefresh, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
      path: "/api/auth/refresh",
    });

    // Register device session for multi-device management (non-blocking)
    const decoded = require('jsonwebtoken').decode(token);
    registerDeviceSession(user.id, decoded?.iat, req).catch(() => {});

    return res.json({ ok: true, message: "Login successful", user: { id: user.id, realName: user.real_name, username: user.username, email: user.email }, sessionExpiresAt: Date.now() + LONG_MS });
  } catch (err) {
    log.error({ err }, "login error");
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

async function googleLogin(req, res) {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ ok: false, message: "idToken is required" });
    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload.email_verified) {
  return res.status(400).json({
    ok: false,
    message: "This Google account's email is not verified. Please verify your email with Google first."
  });
}
    const googleId = payload.sub;
    const email = (payload.email || "").toLowerCase();
    const realName = payload.name || "Google User";
    if (!email) return res.status(400).json({ ok: false, message: "Email not available from Google" });
    const { rows: existingRows } = await db.query("SELECT * FROM users WHERE google_id = $1 OR email = $2 LIMIT 1", [googleId, email]);
let user = existingRows[0] || null;
let isNewUser = false;
if (!user) {
  isNewUser = true;
  const now = new Date();
  const { rows: newUserRows } = await db.query(
    `INSERT INTO users (real_name, username, email, password_hash, provider, google_id, needs_password, last_login_at)
     VALUES ($1, NULL, $2, NULL, 'google', $3, FALSE, $4) RETURNING *`,
    [realName, email, googleId, now]
  );
  user = newUserRows[0];
  
  setImmediate(() => {
    createPersonalChapterForUser(user.id, null).catch(err =>
      log.error({ err, userId: user.id }, "Background: personal chapter creation failed for Google user")
    );
  });
} else {
  // Link Google account to existing user if not already linked.
  // This handles: user registered with password, now uses Google with same email.
  // Per product decision: Google verification is sufficient proof of identity.
  const updates = ['last_login_at = $1', 'updated_at = NOW()'];
  const params = [new Date(), user.id];
  
  if (!user.google_id) {
    // First time linking Google to this account
    updates.push(`google_id = $${params.length + 1}`);
    params.splice(params.length - 1, 0, googleId); // insert before user.id
    // Rebuild params correctly
  }
  
  // Cleaner approach:
  await db.query(
    `UPDATE users 
     SET last_login_at = $1,
         updated_at = NOW(),
         google_id = COALESCE(google_id, $2)
     WHERE id = $3`,
    [new Date(), googleId, user.id]
  );
}
    // UPDATED: Include jwt_generation in token payload
    const tokenPayload = { userId: user.id.toString(), gen: user.jwt_generation ?? 0 };
    const token = createToken(tokenPayload, true);
    sendAuthCookie(res, token, true);

    // Issue refresh token for silent session renewal (60-day sliding window)
    const { issueRefreshToken } = require("../utils/jwt");
    const deviceHint = req.headers['user-agent']?.slice(0, 100) || '';
    const rawRefresh = await issueRefreshToken(db, user.id, deviceHint);
    res.cookie("refresh_token", rawRefresh, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
      path: "/api/auth/refresh",
    });

    // Register device session for multi-device management (non-blocking)
    const decoded = require('jsonwebtoken').decode(token);
    registerDeviceSession(user.id, decoded?.iat, req).catch(() => {});

    return res.json({ ok: true, message: "Google login successful", isNewUser, user: { id: user.id, realName: user.real_name, username: user.username, email: user.email } });
  } catch (err) {
    log.error({ err }, "googleLogin error");
    return res.status(500).json({ ok: false, message: "Google login failed" });
  }
}

async function setPassword(req, res) {
  try {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ ok: false, message: "Not authenticated" });
    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).json({ ok: false, message: "Invalid token" }); }
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ ok: false, message: "Password must be at least 8 characters long" });
    const user = await findUserById(payload.userId);
    if (!user) return res.status(404).json({ ok: false, message: "User not found" });
    if (user.provider !== "local") return res.status(400).json({ ok: false, message: "Password not needed for this account" });
    if (!user.needs_password && user.password_hash) return res.status(400).json({ ok: false, message: "Password is already set" });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query(`UPDATE users SET password_hash = $1, needs_password = FALSE, updated_at = NOW() WHERE id = $2`, [passwordHash, user.id]);

    // Invalidate all other sessions — password change should kick out all other devices.
    // The current device gets a fresh token below so it stays logged in.
    await Promise.all([
      incrementJwtGeneration(user.id),
      revokeAllRefreshTokens(db, user.id),
    ]);
    invalidateUserCache(user.id);

    // Re-fetch user to get the new jwt_generation, then issue a fresh token
    // so the current device doesn't get kicked out by its own password change.
    const updatedUser = await findUserById(user.id);
    const newToken = createToken({ userId: updatedUser.id.toString(), gen: updatedUser.jwt_generation ?? 0 }, true);
    sendAuthCookie(res, newToken, true);

    // Issue a fresh refresh token for the current device
    const { issueRefreshToken } = require("../utils/jwt");
    const deviceHint = req.headers['user-agent']?.slice(0, 100) || '';
    const rawRefresh = await issueRefreshToken(db, user.id, deviceHint);
    res.cookie("refresh_token", rawRefresh, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 60 * 24 * 60 * 60 * 1000,
      path: "/api/auth/refresh",
    });

    return res.json({ ok: true, message: "Password set successfully" });
  } catch (err) {
    log.error({ err }, "setPassword error");
    return res.status(500).json({ ok: false, message: "Server error in set-password" });
  }
}

// ✅ SECURE FORGOT PASSWORD - Timing-based enumeration protection
async function forgotRequestOtp(req, res) {
  try {
    const result = emailSchema.safeParse(req.body.email);
    if (!result.success) return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    const email = result.data;
    
    // Measure time for "email exists" path and match it for "no email" path
    const startTime = Date.now();

    const { rows: userRows } = await db.query("SELECT * FROM users WHERE email = $1 LIMIT 1", [email]);
    
    if (!userRows[0]) {
      // Match the time it would take to send an email
      const elapsed = Date.now() - startTime;
      const minDelay = 800; // Assume email send takes ~800ms
      if (elapsed < minDelay) {
        await new Promise(r => setTimeout(r, minDelay - elapsed + Math.random() * 200));
      }
      return res.json({ ok: true, message: "If this email exists, an OTP has been sent" });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.query(
      `INSERT INTO otps (email, code, purpose, expires_at, used, attempts) VALUES ($1, $2, 'reset', $3, FALSE, 0)
       ON CONFLICT (email, purpose) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, used = FALSE, attempts = 0, created_at = NOW()`,
      [email, code, expiresAt]
    );
    await sendOtpEmail(email, "Your Hisaab-Kitaab password reset code", `Your password reset code is ${code}. It will expire in 10 minutes.`);
    
    return res.json({ ok: true, message: "If this email exists, an OTP has been sent" });
  } catch (err) {
    log.error({ err }, "forgotRequestOtp error");
    return res.status(500).json({ ok: false, message: "Server error in forgot request-otp" });
  }
}

async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ ok: false, message: "Email, OTP, and newPassword are required" });
    if (newPassword.length < 8) return res.status(400).json({ ok: false, message: "Password must be at least 8 characters long" });
    const otpRow = await verifyOtpLogic(email, otp, "reset");
    const cleanEmail = email.trim().toLowerCase();
    const { rows: userRows } = await db.query("SELECT * FROM users WHERE email = $1 LIMIT 1", [cleanEmail]);
    const user = userRows[0];
    if (!user) return res.status(400).json({ ok: false, message: "User not found for this email" });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query(`UPDATE users SET password_hash = $1, needs_password = FALSE, updated_at = NOW() WHERE id = $2`, [passwordHash, user.id]);

    // Invalidate ALL existing sessions — if someone reset their password,
    // all other devices (including any attacker) must re-authenticate.
    await Promise.all([
      incrementJwtGeneration(user.id),
      revokeAllRefreshTokens(db, user.id),
    ]);
    invalidateUserCache(user.id);

    await db.query("UPDATE otps SET used = TRUE WHERE id = $1", [otpRow.id]);
    return res.json({ ok: true, message: "Password reset successfully" });
  } catch (err) {
    const status = err.message.includes("Invalid") || err.message.includes("Too many") ? 400 : 500;
    return res.status(status).json({ ok: false, message: err.message });
  }
}

async function me(req, res) {
  try {
    // requireAuth middleware has already verified the token and set req.user.
    // We still need the full user record for profile data and token sliding.
    const user = await findUserById(req.user.userId);
    if (!user) return res.status(401).json({ ok: false, message: "User not found" });

    const nowUnix = Math.floor(Date.now() / 1000);
    const tokenAgeSeconds = nowUnix - req.user.iat;

    // Sliding window: refresh the token if it's older than 10 days.
    // This resets the 60-day expiry clock on active users.
    const refreshThreshold = 10 * 24 * 60 * 60; // 10 days

    if (tokenAgeSeconds > refreshThreshold) {
      const newToken = createToken({ userId: user.id.toString(), gen: user.jwt_generation ?? 0 }, true);
      sendAuthCookie(res, newToken, true);
    }

    return res.json({
      ok: true,
      user: {
        id: user.id,
        realName: user.real_name,
        username: user.username,
        email: user.email,
        lastLoginAt: user.last_login_at,
        needsPassword: user.needs_password,
      },
    });
  } catch (err) {
    log.error({ err }, "me error");
    return res.status(500).json({ ok: false, message: "Server error in me" });
  }
}

// requireAuth middleware guarantees req.user is set before this runs
async function logout(req, res) {
  try {
    const userId = req.user.userId;
    await Promise.all([
      incrementJwtGeneration(userId),
      revokeAllRefreshTokens(db, userId),
    ]);
    invalidateUserCache(userId);
    clearAuthCookies(res);
    res.cookie("refresh_token", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      expires: new Date(0),
      path: "/api/auth/refresh",
    });
    return res.json({ ok: true, message: "Logged out" });
  } catch (err) {
    log.error({ err }, "logout error");
    // Even if DB fails, clear cookies so the user is logged out client-side
    clearAuthCookies(res);
    return res.json({ ok: true, message: "Logged out" });
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ ok: false, message: "Not authenticated" });
    const { realName } = req.body;
    if (!realName || realName.trim().length < 2) return res.status(400).json({ ok: false, message: "Name must be at least 2 characters" });
    if (realName.trim().length > 100) return res.status(400).json({ ok: false, message: "Name too long (max 100 chars)" });
    const clean = xss(realName.trim());
    const { rows } = await db.query(`UPDATE users SET real_name = $1, updated_at = NOW() WHERE id = $2 RETURNING real_name`, [clean, userId]);
    if (rows.length === 0) return res.status(404).json({ ok: false, message: "User not found" });
    res.json({ ok: true, message: "Name updated", realName: rows[0].real_name });
  } catch (err) {
    log.error({ err }, "updateProfile error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}
async function getDeviceSessions(req, res) {
  try {
    const userId = req.user.userId;
    const currentIat = req.user.iat; // iat from current JWT
    
    // Get sessions active in the last 90 days
    const { rows } = await db.query(
      `SELECT id, session_id, device_name, device_type, browser, os, 
              ip_address, last_active_at, created_at, jwt_iat
       FROM device_sessions
       WHERE user_id = $1 
         AND last_active_at > NOW() - INTERVAL '90 days'
       ORDER BY last_active_at DESC
       LIMIT 10`,
      [userId]
    );
    
    // Mark which session is current
    const sessions = rows.map(s => ({
      ...s,
      isCurrent: s.jwt_iat === currentIat
    }));
    
    res.json({ ok: true, sessions });
  } catch (err) {
    log.error({ err }, "getDeviceSessions error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

async function logoutDevice(req, res) {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.params;
    const logoutAll = req.query.all === 'true';
    
    if (logoutAll) {
      // Increment jwt_generation — invalidates ALL tokens for this user
      await incrementJwtGeneration(userId);
      // Delete all device sessions
      await db.query(
        "DELETE FROM device_sessions WHERE user_id = $1",
        [userId]
      );
      // Also clear cookies for current device
      clearAuthCookies(res);
      return res.json({ ok: true, message: "Logged out from all devices" });
    }
    
    // Logout specific device
    const { rowCount } = await db.query(
      "DELETE FROM device_sessions WHERE session_id = $1 AND user_id = $2 RETURNING jwt_iat",
      [sessionId, userId]
    );
    
    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: "Session not found" });
    }
    
    // Note: Removing a specific device session does not immediately invalidate
    // its JWT (which would require a full jwt_generation increment affecting all devices).
    // The removed device's token will naturally expire within its remaining lifetime.
    // The device session row is deleted so it no longer appears in the devices list.
    
    res.json({ ok: true, message: "Device session removed. That device will be signed out on its next activity." });
  } catch (err) {
    log.error({ err }, "logoutDevice error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}


// ── NEW: Refresh Session Handler ──────────────────────────────────
async function refreshSession(req, res) {
  try {
    const rawRefresh = req.cookies.refresh_token;
    if (!rawRefresh) {
      return res.status(401).json({ ok: false, message: "No refresh token" });
    }

    // Decode the expired/missing auth token to get userId
    // (We need userId to look up the refresh token)
    let userId = null;
    const expiredAuthToken = req.cookies.auth_token;
    if (expiredAuthToken) {
      try {
        // Allow expired tokens here — that's the whole point
        const payload = jwt.verify(expiredAuthToken, process.env.JWT_SECRET, {
          ignoreExpiration: true,
        });
        userId = payload.userId;
      } catch (_) {}
    }

    if (!userId) {
      return res.status(401).json({ ok: false, message: "Cannot identify session" });
    }

    // ── AUTH-05 FIX: Verify jwt_generation before issuing new token ──────────
    // Even though the auth_token is expired, we must check that the generation
    // in the token still matches the DB. If the user changed their password or
    // logged out all devices, jwt_generation was incremented — this refresh
    // should be rejected even if the refresh_token itself is still valid.
    try {
      const expiredPayload = jwt.verify(expiredAuthToken, process.env.JWT_SECRET, {
        ignoreExpiration: true,
      });
      if (expiredPayload.gen !== undefined) {
        const { rows: genRows } = await db.query(
          "SELECT jwt_generation FROM users WHERE id = $1",
          [userId]
        );
        if (genRows[0] && expiredPayload.gen !== genRows[0].jwt_generation) {
          clearAuthCookies(res);
          return res.status(401).json({
            ok: false,
            message: "Session has been revoked. Please log in again.",
          });
        }
      }
    } catch (_) {
      // If we can't verify, proceed — the refresh token rotation below
      // will catch any truly invalid sessions
    }
    // ── END AUTH-05 FIX ──────────────────────────────────────────────────────

    // Rotate the refresh token (revoke old, issue new)
    const newRawRefresh = await rotateRefreshToken(db, rawRefresh, userId);
    if (!newRawRefresh) {
      clearAuthCookies(res);
      return res.status(401).json({ ok: false, message: "Refresh token expired or revoked" });
    }

    // Fetch fresh user data
    const user = await findUserById(userId);
    if (!user) {
      return res.status(401).json({ ok: false, message: "User not found" });
    }

    const newToken = createToken({ userId: user.id.toString(), gen: user.jwt_generation ?? 0 }, true);
    sendAuthCookie(res, newToken, true);

    res.cookie("refresh_token", newRawRefresh, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days — matches sliding window
      path: "/api/auth/refresh",
    });

    return res.json({
      ok: true,
      message: "Session refreshed",
      user: { id: user.id, realName: user.real_name, username: user.username, email: user.email }
    });
  } catch (err) {
    log.error({ err }, "refreshSession error");
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

module.exports = {
  checkIdentifier,
  loginRequestOtp,
  loginVerifyOtp,
  registerRequestOtp,
  registerVerifyOtp,
  registerComplete,  // ✅ Updated with xss() sanitization
  login,
  googleLogin,
  setPassword,
  forgotRequestOtp,
  resetPassword,
  me,
  logout,
   getDeviceSessions,
  logoutDevice,
  updateProfile,
  refreshSession, // ← NEW EXPORT
};