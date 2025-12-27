/* server/controllers/authController.js */
const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const { sendOtpEmail } = require("../utils/email");
const bcrypt = require("bcrypt");
const db = require("../config/db");
const { createToken, sendAuthCookie, clearAuthCookies, SHORT_MS, LONG_MS } = require("../utils/jwt");
const jwt = require("jsonwebtoken");
const { 
  registerSchema, 
  loginSchema, 
  emailSchema, 
  normalizeEmail 
} = require("../utils/validation"); // ✅ Import shared validation

// helper: generate 6-digit OTP
function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// helper: find user by id
async function findUserById(id) {
  const { rows } = await db.query(
    "SELECT * FROM users WHERE id = $1 LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

// helper: find user by identifier (updated to handle nullable username)
async function findUserByIdentifier(identifier) {
  const { rows } = await db.query(
    "SELECT * FROM users WHERE email = $1 OR (username = $1 AND username IS NOT NULL) LIMIT 1",
    [identifier]
  );
  return rows[0] || null;
}

// ✅ UPDATED: checkIdentifier as Express Controller
async function checkIdentifier(req, res) {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ ok: false, message: "Identifier required" });

    const cleanIdentifier = identifier.trim().toLowerCase();
    const user = await findUserByIdentifier(cleanIdentifier);

    if (!user) {
      return res.json({ ok: true, exists: false });
    }

    return res.json({
      ok: true,
      exists: true,
      email: user.email,
      provider: user.provider,
      hasPassword: !!user.password_hash,
    });
  } catch (err) {
    console.error("checkIdentifier error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ✅ UPDATED: loginRequestOtp - uses DB helper directly
async function loginRequestOtp(req, res) {
  try {
    const result = emailSchema.safeParse(req.body.email);
    if (!result.success) return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    
    const email = result.data;

    const user = await findUserByIdentifier(email);
    
    if (!user) {
      return res.status(404).json({ ok: false, message: "Account not found. Please sign up." });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      `INSERT INTO otps (email, code, purpose, expires_at, used, attempts)
       VALUES ($1, $2, 'login', $3, FALSE, 0)
       ON CONFLICT (email, purpose)
       DO UPDATE SET code = EXCLUDED.code,
                     expires_at = EXCLUDED.expires_at,
                     used = FALSE,
                     attempts = 0,
                     created_at = NOW()`,
      [email, code, expiresAt]
    );

    await sendOtpEmail(
      email,
      "Your Hisaab-Kitaab login code",
      `Your login code is ${code}. It will expire in 10 minutes.`
    );

    return res.json({
      ok: true,
      message: "Login OTP sent to your email",
    });
  } catch (err) {
    console.error("loginRequestOtp error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ✅ NEW: loginVerifyOtp (exported)
async function loginVerifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ ok: false, message: "Missing data" });

    const otpRow = await verifyOtpLogic(email, otp, "login");

    const tempToken = jwt.sign(
      { email: email.trim().toLowerCase(), purpose: "complete_login", otpId: otpRow.id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.cookie("login_token", tempToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
    });

    return res.json({ ok: true, message: "Login code verified successfully" });
  } catch (err) {
    const status = err.message.includes("Invalid") || err.message.includes("Too many") ? 400 : 500;
    return res.status(status).json({ ok: false, message: err.message });
  }
}

// ✅ FIX S9: Enhanced OTP Verification with Brute Force Protection
async function verifyOtpLogic(email, otp, purpose) {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Fetch OTP with attempts
  const { rows } = await db.query(
    `SELECT * FROM otps 
     WHERE email = $1 AND purpose = $2 AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [cleanEmail, purpose]
  );
  
  const otpRow = rows[0];

  if (!otpRow) {
    throw new Error("Invalid or expired OTP");
  }

  // 2. Check Max Attempts (Brute Force Protection)
  if (otpRow.attempts >= 3) {
    await db.query("DELETE FROM otps WHERE id = $1", [otpRow.id]);
    throw new Error("Too many failed attempts. Please request a new code.");
  }

  // 3. Verify Code
  if (otpRow.code !== otp) {
    await db.query("UPDATE otps SET attempts = attempts + 1 WHERE id = $1", [otpRow.id]);
    throw new Error("Invalid OTP code");
  }

  return otpRow;
}

// POST /api/auth/register/request-otp
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
      `INSERT INTO otps (email, code, purpose, expires_at, used, attempts)
       VALUES ($1, $2, 'signup', $3, FALSE, 0)
       ON CONFLICT (email, purpose)
       DO UPDATE SET code = EXCLUDED.code,
                     expires_at = EXCLUDED.expires_at,
                     used = FALSE,
                     attempts = 0,
                     created_at = NOW()`,
      [email, code, expiresAt]
    );

    await sendOtpEmail(
      email,
      "Your Hisaab-Kitaab verification code",
      `Your verification code is ${code}. It will expire in 10 minutes.`
    );

    return res.json({
      ok: true,
      message: "OTP sent to your email address",
    });
  } catch (err) {
    console.error("registerRequestOtp error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ✅ FIX S9: UPDATED registerVerifyOtp with verifyOtpLogic
async function registerVerifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ ok: false, message: "Missing data" });

    const otpRow = await verifyOtpLogic(email, otp, "signup");

    const tempToken = jwt.sign(
      { email: email.trim().toLowerCase(), purpose: "complete_signup", otpId: otpRow.id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.cookie("signup_token", tempToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
    });

    return res.json({ ok: true, message: "Email verified successfully" });
  } catch (err) {
    const status = err.message.includes("Invalid") || err.message.includes("Too many") ? 400 : 500;
    return res.status(status).json({ ok: false, message: err.message });
  }
}

// ✅ UPDATED: registerComplete with AUTO-GENERATED USERNAME
async function registerComplete(req, res) {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ ok: false, message: result.error.issues[0].message });

    const { realName, password } = result.data;
    
    // 2. Verify signup token
    const signupToken = req.cookies.signup_token;
    if (!signupToken) {
      return res.status(401).json({ ok: false, message: "Email verification required." });
    }

    let payload;
    try {
      payload = jwt.verify(signupToken, process.env.JWT_SECRET);
      if (payload.purpose !== "complete_signup") throw new Error();
    } catch {
      return res.status(401).json({ ok: false, message: "Invalid verification." });
    }

    const email = payload.email;
    const otpId = payload.otpId;

    await db.query("BEGIN");

    try {
      const { rows: otpCheck } = await db.query("SELECT used FROM otps WHERE id = $1 FOR UPDATE", [otpId]);
      if (!otpCheck[0] || otpCheck[0].used) {
        await db.query("ROLLBACK");
        return res.status(400).json({ ok: false, message: "Link already used" });
      }

      const { rows: existingRows } = await db.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
      if (existingRows[0]) {
        await db.query("ROLLBACK");
        return res.status(400).json({ ok: false, message: "Email already in use" });
      }

      // =========================================================
      // 🟢 AUTO-GENERATE USERNAME (Logic from Google Login)
      // =========================================================
      const baseUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      let username = baseUsername;
      let counter = 1;

      // Ensure uniqueness
      while (true) {
        const { rows: uRows } = await db.query("SELECT 1 FROM users WHERE username = $1 LIMIT 1", [username]);
        if (uRows.length === 0) break;
        username = `${baseUsername}${counter++}`;
      }
      // =========================================================

      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date();

      const { rows: userRows } = await db.query(
        `INSERT INTO users
          (real_name, username, email, password_hash, provider,
           google_id, needs_password, last_login_at)
         VALUES ($1, $2, $3, $4, 'local', NULL, FALSE, $5)
         RETURNING *`,
        [realName, username, email, passwordHash, now]
      );
      const user = userRows[0];

      await db.query("UPDATE otps SET used = TRUE WHERE id = $1", [otpId]);
      await db.query("COMMIT");

      res.clearCookie("signup_token");
      const token = createToken({ userId: user.id.toString() });
      sendAuthCookie(res, token);

      return res.json({
        ok: true,
        message: "Account created successfully",
        user: { id: user.id, realName: user.real_name, username: user.username, email: user.email },
      });

    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error("registerComplete error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

// POST /api/auth/login (Standard + Final OTP Step) - ✅ FIXED
async function login(req, res) {
  try {
    // 1. Check for OTP Login Token (Cookie)
    const loginToken = req.cookies.login_token;
    
    // CASE A: OTP LOGIN (Final Step)
    if (loginToken) {
        let payload;
        try {
          payload = jwt.verify(loginToken, process.env.JWT_SECRET);
          if (payload.purpose !== "complete_login") throw new Error();
        } catch {
          // If token invalid, fall through to password check or error
          res.clearCookie("login_token");
          return res.status(401).json({ ok: false, message: "Session expired. Please verify OTP again." });
        }

        // Verify OTP wasn't reused
        const { rows: otpCheck } = await db.query("SELECT used FROM otps WHERE id = $1 FOR UPDATE", [payload.otpId]);
        if (!otpCheck[0] || otpCheck[0].used) {
          return res.status(400).json({ ok: false, message: "This code has already been used." });
        }

        // Get User
        const user = await findUserByIdentifier(payload.email);
        if (!user) return res.status(400).json({ ok: false, message: "User not found" });

        // ✅ FIX: REMOVED the "password_hash" check here.
        // Since they verified via OTP, we trust them and log them in immediately.

        // Complete Login
        await db.query("UPDATE otps SET used = TRUE WHERE id = $1", [payload.otpId]);
        res.clearCookie("login_token"); // Clear temp cookie

        // Issue real session
        const rememberMe = !!req.body.rememberMe;
        const token = createToken({ userId: user.id.toString() }, rememberMe);
        sendAuthCookie(res, token, rememberMe);

        return res.json({
          ok: true,
          message: "Login successful",
          user: { id: user.id, realName: user.real_name, username: user.username, email: user.email },
          sessionExpiresAt: Date.now() + (rememberMe ? LONG_MS : SHORT_MS)
        });
    }

    // CASE B: PASSWORD LOGIN (Standard)
    // If no OTP cookie, we expect password in body
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ ok: false, message: "Missing credentials" });
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) return res.status(400).json({ ok: false, message: "Invalid credentials" });

    // Block if user has no password (e.g. Google user trying to force password login)
    if (!user.password_hash) {
      return res.status(400).json({ ok: false, message: "This account uses Google/OTP login." });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ ok: false, message: "Invalid credentials" });

    const rememberMe = !!req.body.rememberMe;
    const token = createToken({ userId: user.id.toString() }, rememberMe);
    sendAuthCookie(res, token, rememberMe);

    return res.json({
      ok: true,
      message: "Login successful",
      user: { id: user.id, realName: user.real_name, username: user.username, email: user.email },
      sessionExpiresAt: Date.now() + (rememberMe ? LONG_MS : SHORT_MS)
    });

  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

// POST /api/auth/google (UPDATED: username now nullable)
async function googleLogin(req, res) {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res
        .status(400)
        .json({ ok: false, message: "idToken is required" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = (payload.email || "").toLowerCase();
    const realName = payload.name || "Google User";

    if (!email) {
      return res
        .status(400)
        .json({ ok: false, message: "Email not available from Google" });
    }

    const { rows: existingRows } = await db.query(
      "SELECT * FROM users WHERE google_id = $1 OR email = $2 LIMIT 1",
      [googleId, email]
    );
    let user = existingRows[0] || null;

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const now = new Date();
      const { rows: newUserRows } = await db.query(
        `INSERT INTO users
          (real_name, username, email, password_hash, provider,
           google_id, needs_password, last_login_at)
         VALUES ($1, NULL, $2, NULL, 'google', $3, FALSE, $4)
         RETURNING *`,
        [realName, email, googleId, now]
      );
      user = newUserRows[0];
    } else {
      const now = new Date();
      await db.query(
        "UPDATE users SET last_login_at = $1, updated_at = NOW() WHERE id = $2",
        [now, user.id]
      );
    }

    const token = createToken({ userId: user.id.toString() });
    sendAuthCookie(res, token);

    return res.json({
      ok: true,
      message: "Google login successful",
      isNewUser,
      user: {
        id: user.id,
        realName: user.real_name,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("googleLogin error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Google login failed" });
  }
}

// POST /api/auth/set-password
async function setPassword(req, res) {
  try {
    const token = req.cookies.auth_token;
    if (!token) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ ok: false, message: "Invalid token" });
    }

    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ 
        ok: false, 
        message: "Password must be at least 8 characters long" 
      });
    }

    const user = await findUserById(payload.userId);
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    if (user.provider !== "local") {
      return res.status(400).json({
        ok: false,
        message: "Password not needed for this account",
      });
    }

    if (!user.needs_password && user.password_hash) {
      return res.status(400).json({
        ok: false,
        message: "Password is already set",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users
       SET password_hash = $1,
           needs_password = FALSE,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    return res.json({ ok: true, message: "Password set successfully" });
  } catch (err) {
    console.error("setPassword error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Server error in set-password" });
  }
}

// POST /api/auth/forgot/request-otp
async function forgotRequestOtp(req, res) {
  try {
    const result = emailSchema.safeParse(req.body.email);
    if (!result.success) return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    
    const email = result.data;

    const { rows: userRows } = await db.query(
      "SELECT * FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    if (!userRows[0]) {
      return res.json({
        ok: true,
        message: "If this email exists, an OTP has been sent",
      });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      `INSERT INTO otps (email, code, purpose, expires_at, used, attempts)
       VALUES ($1, $2, 'reset', $3, FALSE, 0)
       ON CONFLICT (email, purpose)
       DO UPDATE SET code = EXCLUDED.code,
                     expires_at = EXCLUDED.expires_at,
                     used = FALSE,
                     attempts = 0,
                     created_at = NOW()`,
      [email, code, expiresAt]
    );

    await sendOtpEmail(
      email,
      "Your Hisaab-Kitaab password reset code",
      `Your password reset code is ${code}. It will expire in 10 minutes.`
    );

    return res.json({
      ok: true,
      message: "If this email exists, an OTP has been sent",
    });
  } catch (err) {
    console.error("forgotRequestOtp error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Server error in forgot request-otp" });
  }
}

// ✅ FIX S9: UPDATED resetPassword with verifyOtpLogic
async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        ok: false,
        message: "Email, OTP, and newPassword are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        ok: false, 
        message: "Password must be at least 8 characters long" 
      });
    }

    const otpRow = await verifyOtpLogic(email, otp, "reset");

    const cleanEmail = email.trim().toLowerCase();
    const { rows: userRows } = await db.query(
      "SELECT * FROM users WHERE email = $1 LIMIT 1",
      [cleanEmail]
    );
    const user = userRows[0];

    if (!user) {
      return res
        .status(400)
        .json({ ok: false, message: "User not found for this email" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users
       SET password_hash = $1,
           needs_password = FALSE,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    await db.query("UPDATE otps SET used = TRUE WHERE id = $1", [otpRow.id]);

    return res.json({
      ok: true,
      message: "Password reset successfully",
    });
  } catch (err) {
    const status = err.message.includes("Invalid") || err.message.includes("Too many") ? 400 : 500;
    return res.status(status).json({ ok: false, message: err.message });
  }
}

// ✅ UPDATED: GET /api/auth/me with SLIDING WINDOW Token Refresh
async function me(req, res) {
  try {
    const token = req.cookies.auth_token;
    if (!token) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ ok: false, message: "Invalid token" });
    }

    const user = await findUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ ok: false, message: "User not found" });
    }

    // =========================================================
    // ✅ SLIDING WINDOW: Auto-Refresh Session
    // =========================================================
    const nowUnix = Math.floor(Date.now() / 1000);
    const tokenAgeSeconds = nowUnix - payload.iat;
    const refreshThreshold = 24 * 60 * 60; // 1 day (86400 seconds)

    if (tokenAgeSeconds > refreshThreshold) {
       const originalDuration = payload.exp - payload.iat;
       const isRemembered = originalDuration > (86400 + 1000);

       const newToken = createToken({ userId: user.id.toString() }, isRemembered);
       sendAuthCookie(res, newToken, isRemembered);
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
    console.error("me error:", err);
    return res.status(500).json({ ok: false, message: "Server error in me" });
  }
}

// ✅ FIX B12: Clean up all cookies using helper
// POST /api/auth/logout
function logout(req, res) {
  try {
    clearAuthCookies(res);
    return res.json({ ok: true, message: "Logged out" });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ ok: false, message: "Server error in logout" });
  }
}

module.exports = {
  checkIdentifier,
  loginRequestOtp,
  loginVerifyOtp,
  registerRequestOtp,
  registerVerifyOtp,
  registerComplete,
  login,
  googleLogin,
  setPassword,
  forgotRequestOtp,
  resetPassword,
  me,
  logout,
};
