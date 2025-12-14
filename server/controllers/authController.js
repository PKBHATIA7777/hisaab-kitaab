const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const { sendOtpEmail } = require("../utils/email");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Otp = require("../models/Otp");
const { createToken, sendAuthCookie } = require("../utils/jwt");
const jwt = require("jsonwebtoken");

// helper: generate 6-digit OTP
function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }],
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ ok: false, message: "Email or username already in use" });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.findOneAndUpdate(
      { email: cleanEmail, purpose: "signup" },
      {
        email: cleanEmail,
        code,
        purpose: "signup",
        expiresAt,
        consumed: false,
        signupData: {
          realName,
          username: cleanUsername,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
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
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ ok: false, message: "Email and OTP are required" });
    }

    const cleanEmail = email.trim().toLowerCase();

    const otpDoc = await Otp.findOne({
      email: cleanEmail,
      purpose: "signup",
      code: otp,
      consumed: false,
    });

    if (!otpDoc) {
      return res.status(400).json({ ok: false, message: "Invalid OTP" });
    }

    if (otpDoc.expiresAt < new Date()) {
      return res.status(400).json({ ok: false, message: "OTP expired" });
    }

    const signupData = otpDoc.signupData;
    if (!signupData) {
      return res
        .status(400)
        .json({ ok: false, message: "No signup data stored for this OTP" });
    }

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { username: signupData.username }],
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ ok: false, message: "User already exists" });
    }

    const user = await User.create({
      realName: signupData.realName,
      username: signupData.username,
      email: cleanEmail,
      passwordHash: null,
      provider: "local",
      needsPassword: true,
      lastLoginAt: new Date(),
      logins: [{ method: "local" }],
    });

    otpDoc.consumed = true;
    await otpDoc.save();

    const token = createToken({ userId: user._id.toString() });
    sendAuthCookie(res, token);

    return res.json({
      ok: true,
      message: "Signup complete",
      user: {
        id: user._id,
        realName: user.realName,
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

    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { username: cleanIdentifier }],
    });

    if (!user) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid credentials" });
    }

    if (user.needsPassword) {
      return res.status(400).json({
        ok: false,
        message: "Please set your password first.",
      });
    }

    if (!user.passwordHash) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid credentials" });
    }

    user.lastLoginAt = new Date();
    user.logins.push({ method: "local" });
    await user.save();

    const token = createToken({ userId: user._id.toString() });
    sendAuthCookie(res, token);

    return res.json({
      ok: true,
      message: "Login successful",
      user: {
        id: user._id,
        realName: user.realName,
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

    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      const baseUsername = email.split("@")[0].toLowerCase();
      let username = baseUsername;
      let counter = 1;

      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter++}`;
      }

      user = await User.create({
        realName,
        username,
        email,
        provider: "google",
        googleId,
        needsPassword: false,
        lastLoginAt: new Date(),
        logins: [{ method: "google" }],
      });
    } else {
      user.lastLoginAt = new Date();
      user.logins.push({ method: "google" });
      await user.save();
    }

    const token = createToken({ userId: user._id.toString() });
    sendAuthCookie(res, token);

    return res.json({
      ok: true,
      message: "Google login successful",
      isNewUser,
      user: {
        id: user._id,
        realName: user.realName,
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

    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    if (user.provider !== "local") {
      return res.status(400).json({
        ok: false,
        message: "Password not needed for this account",
      });
    }

    if (!user.needsPassword && user.passwordHash) {
      return res.status(400).json({
        ok: false,
        message: "Password is already set",
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.needsPassword = false;
    await user.save();

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

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.json({
        ok: true,
        message: "If this email exists, an OTP has been sent",
      });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.findOneAndUpdate(
      { email: cleanEmail, purpose: "reset" },
      {
        email: cleanEmail,
        code,
        purpose: "reset",
        expiresAt,
        consumed: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
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

    const otpDoc = await Otp.findOne({
      email: cleanEmail,
      purpose: "reset",
      code: otp,
      consumed: false,
    });

    if (!otpDoc) {
      return res.status(400).json({ ok: false, message: "Invalid OTP" });
    }

    if (otpDoc.expiresAt < new Date()) {
      return res.status(400).json({ ok: false, message: "OTP expired" });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res
        .status(400)
        .json({ ok: false, message: "User not found for this email" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.needsPassword = false;
    await user.save();

    otpDoc.consumed = true;
    await otpDoc.save();

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

    const user = await User.findById(payload.userId).select(
      "realName username email lastLoginAt needsPassword"
    );

    if (!user) {
      return res.status(401).json({ ok: false, message: "User not found" });
    }

    return res.json({
      ok: true,
      user: {
        id: user._id,
        realName: user.realName,
        username: user.username,
        email: user.email,
        lastLoginAt: user.lastLoginAt,
        needsPassword: user.needsPassword,
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
