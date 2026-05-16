const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const { sendOtpEmail } = require("../utils/email");
const bcrypt = require("bcrypt");
const xss = require("xss");
const db = require("../config/db");
const { createToken, sendAuthCookie, clearAuthCookies, SHORT_MS, LONG_MS, incrementJwtGeneration, rotateRefreshToken, revokeAllRefreshTokens } = require("../utils/jwt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); // ✅ ADDED for constant-time OTP comparison
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
  return Math.floor(100000 + Math.random() * 900000).toString();
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
    console.error("checkIdentifier error:", err);
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
    console.error("loginRequestOtp error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

async function loginVerifyOtp(req, res) {
  try {
    const { email, otp, rememberMe } = req.body;
    if (!email || !otp) return res.status(400).json({ ok: false, message: "Missing data" });
    const otpRow = await verifyOtpLogic(email, otp, "login");
    await db.query("UPDATE otps SET used = TRUE WHERE id = $1", [otpRow.id]);
    const user = await findUserByIdentifier(email.trim().toLowerCase());
    if (!user) return res.status(400).json({ ok: false, message: "User not found" });
    const remember = !!rememberMe;
    // UPDATED: Include jwt_generation in token payload
    const token = createToken({ userId: user.id.toString(), gen: user.jwt_generation ?? 0 }, remember);
    sendAuthCookie(res, token, remember);
    return res.json({ ok: true, message: "Login successful", user: { id: user.id, realName: user.real_name, username: user.username, email: user.email }, sessionExpiresAt: Date.now() + (remember ? LONG_MS : SHORT_MS) });
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
  const inputBuf = Buffer.alloc(6, cleanOtp);
  const expectedBuf = Buffer.alloc(6, expectedCode);

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
    console.error("registerRequestOtp error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

async function registerVerifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ ok: false, message: "Missing data" });
    const otpRow = await verifyOtpLogic(email, otp, "signup");
    
    // STEP 7: Create short-lived token for iOS ITP fallback
    const tempToken = jwt.sign(
      { email: email.trim().toLowerCase(), purpose: "complete_signup", otpId: otpRow.id },
      process.env.JWT_SECRET, { expiresIn: "15m" }
    );

    // ✅ FIX: Use environment-aware cookie settings (was hardcoded to secure:true, sameSite:"none")
    // On iOS Safari in dev (HTTP localhost), sameSite:none without Secure blocks the cookie
    res.cookie("signup_token", tempToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
      path: "/",
    });

    // STEP 7: Also return token in response body for iOS ITP environments
    // Frontend stores this in sessionStorage as fallback when cookies are blocked
    return res.json({ 
      ok: true, 
      message: "Email verified successfully",
      _signupToken: tempToken
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
    
    // STEP 7: Read signup token from cookie OR Authorization header (iOS ITP fallback)
    const signupToken = req.cookies.signup_token || 
      (req.headers.authorization?.startsWith('Bearer ') ? 
        req.headers.authorization.slice(7) : null);
    
    if (!signupToken) return res.status(401).json({ ok: false, message: "Email verification required." });

    let payload;
    try {
      payload = jwt.verify(signupToken, process.env.JWT_SECRET);
      if (payload.purpose !== "complete_signup") throw new Error();
    } catch {
      return res.status(401).json({ ok: false, message: "Invalid verification." });
    }

    const email = payload.email;
    const otpId = payload.otpId;

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
      await client.query("COMMIT");

      // ✅ FIX 1: Auto-create personal chapter (non-fatal, fire-and-forget)
      // Don't block the response; background job handles chapter creation
      try {
        setImmediate(() => {
          createPersonalChapterForUser(user.id, null).catch(err =>
            console.error(`Background: personal chapter creation failed for user ${user.id}:`, err.message)
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
      const token = createToken({ userId: user.id.toString(), gen: user.jwt_generation ?? 0 });
      sendAuthCookie(res, token);

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
    console.error("registerComplete error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

async function login(req, res) {
  try {
    const { identifier, password, rememberMe } = req.body;
    if (!identifier || !password) return res.status(400).json({ ok: false, message: "Missing credentials" });
    const user = await findUserByIdentifier(identifier);
    if (!user) return res.status(400).json({ ok: false, message: "Invalid credentials" });
    if (!user.password_hash) return res.status(400).json({ ok: false, message: "This account uses Google/OTP login." });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ ok: false, message: "Invalid credentials" });
    const remember = !!rememberMe;
    // UPDATED: Include jwt_generation in token payload
    const token = createToken({ userId: user.id.toString(), gen: user.jwt_generation ?? 0 }, remember);
    sendAuthCookie(res, token, remember);
    return res.json({ ok: true, message: "Login successful", user: { id: user.id, realName: user.real_name, username: user.username, email: user.email }, sessionExpiresAt: Date.now() + (remember ? LONG_MS : SHORT_MS) });
  } catch (err) {
    console.error("login error:", err);
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
      
      // ✅ FIX 4: Auto-create personal chapter for Google user (fire-and-forget)
      setImmediate(() => {
        createPersonalChapterForUser(user.id, null).catch(err =>
          console.error(`Background: personal chapter for Google user ${user.id}:`, err.message)
        );
      });
    } else {
      await db.query("UPDATE users SET last_login_at = $1, updated_at = NOW() WHERE id = $2", [new Date(), user.id]);
    }
    // UPDATED: Include jwt_generation in token payload
    const token = createToken({ userId: user.id.toString(), gen: user.jwt_generation ?? 0 }, true);
    sendAuthCookie(res, token, true);
    return res.json({ ok: true, message: "Google login successful", isNewUser, user: { id: user.id, realName: user.real_name, username: user.username, email: user.email } });
  } catch (err) {
    console.error("googleLogin error:", err);
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
    invalidateUserCache(user.id);
    return res.json({ ok: true, message: "Password set successfully" });
  } catch (err) {
    console.error("setPassword error:", err);
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
    console.error("forgotRequestOtp error:", err);
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
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ ok: false, message: "Not authenticated" });
    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).json({ ok: false, message: "Invalid token" }); }
    const user = await findUserById(payload.userId);
    if (!user) return res.status(401).json({ ok: false, message: "User not found" });
    const nowUnix = Math.floor(Date.now() / 1000);
    const tokenAgeSeconds = nowUnix - payload.iat;
    
    // ✅ FIX 3: Increase refresh threshold from 5 days to 10 days to prevent cookie-write storm
    const refreshThreshold = 10 * 24 * 60 * 60; // Refresh only after 10 days
    
    if (tokenAgeSeconds > refreshThreshold) {
      const originalDuration = payload.exp - payload.iat;
      const TWENTY_DAYS_SECONDS = 20 * 24 * 60 * 60;
      const isRemembered = originalDuration > TWENTY_DAYS_SECONDS;
      // UPDATED: Include jwt_generation in token payload
      const newToken = createToken({ userId: user.id.toString(), gen: user.jwt_generation ?? 0 }, isRemembered);
      sendAuthCookie(res, newToken, isRemembered);
    }
    return res.json({ ok: true, user: { id: user.id, realName: user.real_name, username: user.username, email: user.email, lastLoginAt: user.last_login_at, needsPassword: user.needs_password } });
  } catch (err) {
    console.error("me error:", err);
    return res.status(500).json({ ok: false, message: "Server error in me" });
  }
}

// UPDATED: Made async and added jwt_generation increment + cache invalidation + refresh token revocation
async function logout(req, res) {
  try {
    // Revoke all sessions for this user
    const userId = req.user?.userId;
    if (userId) {
      await Promise.all([
        incrementJwtGeneration(userId),
        revokeAllRefreshTokens(db, userId),
      ]);
      // Also invalidate the auth middleware cache
      invalidateUserCache(userId);
    }
    clearAuthCookies(res);
    // Clear refresh token cookie
    res.cookie("refresh_token", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      expires: new Date(0),
      path: "/api/auth/refresh",
    });
    return res.json({ ok: true, message: "Logged out" });
  } catch (err) {
    console.error("logout error:", err);
    // Even if DB fails, clear cookies
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
    console.error("updateProfile error:", err);
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
      maxAge: 90 * 24 * 60 * 60 * 1000,
      path: "/api/auth/refresh",
    });

    return res.json({
      ok: true,
      message: "Session refreshed",
      user: { id: user.id, realName: user.real_name, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error("refreshSession error:", err);
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
  updateProfile,
  refreshSession, // ← NEW EXPORT
};