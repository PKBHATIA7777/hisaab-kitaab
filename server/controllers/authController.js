const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const { sendOtpEmail } = require("../utils/email");
const bcrypt = require("bcrypt");
const db = require("../config/db");
const { createToken, sendAuthCookie } = require("../utils/jwt");
const jwt = require("jsonwebtoken");

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

// helper: find user by email or username
async function findUserByIdentifier(identifier) {
  const { rows } = await db.query(
    "SELECT * FROM users WHERE email = $1 OR username = $1 LIMIT 1",
    [identifier]
  );
  return rows[0] || null;
}

// POST /api/auth/register/request-otp
async function registerRequestOtp(req, res) {
  try {
    const { realName, username, email } = req.body;

    if (!realName || !username || !email) {
      return res
        .status(400)
        .json({ ok: false, message: "All fields are required" });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    const { rows: existingRows } = await db.query(
      "SELECT * FROM users WHERE email = $1 OR username = $2 LIMIT 1",
      [cleanEmail, cleanUsername]
    );
    const existingUser = existingRows[0];

    if (existingUser) {
      return res
        .status(400)
        .json({ ok: false, message: "Email or username already in use" });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // upsert OTP for signup
    await db.query(
      `INSERT INTO otps (email, code, purpose, expires_at, used)
       VALUES ($1, $2, 'signup', $3, FALSE)
       ON CONFLICT (email, purpose)
       DO UPDATE SET code = EXCLUDED.code,
                     expires_at = EXCLUDED.expires_at,
                     used = FALSE,
                     created_at = NOW()`,
      [cleanEmail, code, expiresAt]
    );

    await sendOtpEmail(
      cleanEmail,
      "Your Hisaab-Kitaab sign-up code",
      `Your verification code is ${code}. It will expire in 10 minutes.`
    );

    return res.json({
      ok: true,
      message: "OTP sent to your email address",
    });
  } catch (err) {
    console.error("registerRequestOtp error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Server error in request-otp" });
  }
}

// POST /api/auth/register/verify-otp
async function registerVerifyOtp(req, res) {
  try {
    const { email, otp, realName, username } = req.body;

    if (!email || !otp || !realName || !username) {
      return res.status(400).json({
        ok: false,
        message: "Email, OTP, realName, and username are required",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    const { rows: otpRows } = await db.query(
      `SELECT * FROM otps
       WHERE email = $1
         AND purpose = 'signup'
         AND code = $2
         AND used = FALSE
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [cleanEmail, otp]
    );
    const otpRow = otpRows[0];

    if (!otpRow) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid or expired OTP" });
    }

    const { rows: existingRows } = await db.query(
      "SELECT * FROM users WHERE email = $1 OR username = $2 LIMIT 1",
      [cleanEmail, cleanUsername]
    );
    const existingUser = existingRows[0];

    if (existingUser) {
      return res
        .status(400)
        .json({ ok: false, message: "User already exists" });
    }

    const now = new Date();

    const { rows: userRows } = await db.query(
      `INSERT INTO users
        (real_name, username, email, password_hash, provider,
         google_id, needs_password, last_login_at)
       VALUES ($1, $2, $3, NULL, 'local', NULL, TRUE, $4)
       RETURNING *`,
      [realName, cleanUsername, cleanEmail, now]
    );
    const user = userRows[0];

    await db.query("UPDATE otps SET used = TRUE WHERE id = $1", [otpRow.id]);

    const token = createToken({ userId: user.id.toString() });
    sendAuthCookie(res, token);

    return res.json({
      ok: true,
      message: "Signup complete",
      user: {
        id: user.id,
        realName: user.real_name,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("registerVerifyOtp error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Server error in verify-otp" });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Identifier and password are required" });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    const user = await findUserByIdentifier(cleanIdentifier);

    if (!user) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid credentials" });
    }

    if (user.needs_password) {
      return res.status(400).json({
        ok: false,
        message: "Please set your password first.",
      });
    }

    if (!user.password_hash) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid credentials" });
    }

    const now = new Date();
    await db.query(
      "UPDATE users SET last_login_at = $1, updated_at = NOW() WHERE id = $2",
      [now, user.id]
    );

    const token = createToken({ userId: user.id.toString() });
    sendAuthCookie(res, token);

    return res.json({
      ok: true,
      message: "Login successful",
      user: {
        id: user.id,
        realName: user.real_name,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Server error in login" });
  }
}

// POST /api/auth/google
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

      const baseUsername = email.split("@")[0].toLowerCase();
      let username = baseUsername;
      let counter = 1;

      // ensure username is unique
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { rows: uRows } = await db.query(
          "SELECT 1 FROM users WHERE username = $1 LIMIT 1",
          [username]
        );
        if (uRows.length === 0) break;
        username = `${baseUsername}${counter++}`;
      }

      const now = new Date();
      const { rows: newUserRows } = await db.query(
        `INSERT INTO users
          (real_name, username, email, password_hash, provider,
           google_id, needs_password, last_login_at)
         VALUES ($1, $2, $3, NULL, 'google', $4, FALSE, $5)
         RETURNING *`,
        [realName, username, email, googleId, now]
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
    if (!newPassword) {
      return res
        .status(400)
        .json({ ok: false, message: "newPassword is required" });
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
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ ok: false, message: "Email is required" });
    }

    const cleanEmail = email.trim().toLowerCase();

    const { rows: userRows } = await db.query(
      "SELECT * FROM users WHERE email = $1 LIMIT 1",
      [cleanEmail]
    );
    const user = userRows[0] || null;

    if (!user) {
      return res.json({
        ok: true,
        message: "If this email exists, an OTP has been sent",
      });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      `INSERT INTO otps (email, code, purpose, expires_at, used)
       VALUES ($1, $2, 'reset', $3, FALSE)
       ON CONFLICT (email, purpose)
       DO UPDATE SET code = EXCLUDED.code,
                     expires_at = EXCLUDED.expires_at,
                     used = FALSE,
                     created_at = NOW()`,
      [cleanEmail, code, expiresAt]
    );

    await sendOtpEmail(
      cleanEmail,
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

// POST /api/auth/forgot/reset
async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        ok: false,
        message: "Email, OTP, and newPassword are required",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const { rows: otpRows } = await db.query(
      `SELECT * FROM otps
       WHERE email = $1
         AND purpose = 'reset'
         AND code = $2
         AND used = FALSE
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [cleanEmail, otp]
    );
    const otpRow = otpRows[0] || null;

    if (!otpRow) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid or expired OTP" });
    }

    const { rows: userRows } = await db.query(
      "SELECT * FROM users WHERE email = $1 LIMIT 1",
      [cleanEmail]
    );
    const user = userRows[0] || null;

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
      message: "Password has been reset successfully",
    });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Server error in reset password" });
  }
}

// GET /api/auth/me
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
    return res
      .status(500)
      .json({ ok: false, message: "Server error in me" });
  }
}

// POST /api/auth/logout
function logout(req, res) {
  try {
    res.cookie("auth_token", "", {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      expires: new Date(0),
    });

    return res.json({ ok: true, message: "Logged out" });
  } catch (err) {
    console.error("logout error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Server error in logout" });
  }
}

module.exports = {
  registerRequestOtp,
  registerVerifyOtp,
  login,
  googleLogin,
  setPassword,
  forgotRequestOtp,
  resetPassword,
  me,
  logout,
};
