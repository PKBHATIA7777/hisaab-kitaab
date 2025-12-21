// load environment variables first
require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const compression = require("compression");
const csrfProtection = require("./middleware/csrfMiddleware");
const path = require("path");

// --- SECURITY IMPORTS ---
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
// -----------------------

// DB (connection / pool)
const db = require("./config/db");

// ROUTES
const authRoutes = require("./routes/authRoutes");
const chapterRoutes = require("./routes/chapterRoutes");

const app = express();

// =========================================
// 0. PROXY TRUST (CRITICAL FOR RENDER/HEROKU)
// =========================================
app.set("trust proxy", 1);

// =========================================
/** 1. CORS (MUST BE FIRST) */
// =========================================
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// =========================================
// 2. SECURITY & PERFORMANCE MIDDLEWARES
// =========================================
app.use(compression());

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://accounts.google.com", "https://g.notify.usercontent.com"],
        frameSrc: ["'self'", "https://accounts.google.com"],
        connectSrc: ["'self'", "https://accounts.google.com"],
        imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

// --- RATE LIMITER CONFIGURATION ---
const isProduction = process.env.NODE_ENV === "production";

// ✅ Helper to log rate limit breaches
const rateLimitHandler = (req, res, next, options) => {
  console.warn(`⚠️ Rate Limit Exceeded: IP ${req.ip} tried to access ${req.originalUrl}`);
  res.status(options.statusCode).json(options.message);
};

// 1. Global Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler, // <--- Added Handler
  message: { ok: false, message: "Too many requests, please try again later." },
});
app.use(globalLimiter);

// 2. Strict Auth Limiter
const authLimiter = rateLimit({
  windowMs: isProduction ? 15 * 60 * 1000 : 60 * 1000,
  max: isProduction ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler, // <--- Added Handler
  message: { ok: false, message: "Too many login attempts. Please try again in 15 minutes." },
});

// Apply strict limits to sensitive routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register/request-otp", authLimiter);
app.use("/api/auth/register/verify-otp", authLimiter);
app.use("/api/auth/register/complete", authLimiter);
app.use("/api/auth/forgot/request-otp", authLimiter);

// =========================================
// END SECURITY
// =========================================

// standard middlewares
app.use(express.json());
app.use(cookieParser());

// CSRF protection
app.use(csrfProtection);

// CSRF token endpoint
app.get("/api/csrf-token", (req, res) => {
  res.json({ csrfToken: req.cookies.csrf_token });
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/chapters", chapterRoutes);

// simple health route to test server
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Hisaab-Kitaab backend is running",
  });
});

// =========================================
// ✅ FIX: API 404 HANDLER
// =========================================
// Catch any unhandled /api requests and return JSON instead of HTML
app.use("/api/*", (req, res) => {
  res.status(404).json({
    ok: false,
    message: "API endpoint not found",
  });
});

// =========================================
/** ✅ STATIC FILE SERVING (for Render deployment) */
// =========================================

// 1. Serve static files from the 'client' directory
app.use(express.static(path.join(__dirname, "../client")));

// 2. Handle SPA / Fallback (FIXED)
// We use a Regex to match everything EXCEPT paths starting with /api
// This ensures API 404s stay as 404s, and don't return index.html
app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// =========================================
// HOUSEKEEPING: Cleanup old OTPs
// =========================================

// Run this check every 1 hour
setInterval(async () => {
  try {
    await db.query("DELETE FROM otps WHERE expires_at < NOW()");
    console.log("🧹 Cleaned up expired OTPs");
  } catch (err) {
    console.error("❌ OTP Cleanup Error:", err);
  }
}, 60 * 60 * 1000); // 1 hour

// =========================================
// SERVER START
// =========================================

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
