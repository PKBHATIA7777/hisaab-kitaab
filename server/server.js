// load environment variables first
require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const compression = require("compression");
const csrfProtection = require("./middleware/csrfMiddleware"); // <--- ADDED
const path = require("path"); // ✅ for static file serving

// --- SECURITY IMPORTS ---
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
// -----------------------

// DB (connection / pool)
const db = require("./config/db");

// ROUTES
const authRoutes = require("./routes/authRoutes");
const chapterRoutes = require("./routes/chapterRoutes"); // <-- Line A added

const app = express();

// =========================================
// 0. PROXY TRUST (CRITICAL FOR RENDER/HEROKU)
// =========================================
// This ensures cookies are set with 'Secure' flag and Rate Limiter gets real user IPs
app.set("trust proxy", 1); // <--- ADDED

// =========================================
/** 1. CORS (MUST BE FIRST) */
// =========================================
// configure CORS so frontend can talk to backend
// We put this FIRST so even error responses (like 429) get the correct headers
app.use(
  cors({
    origin: process.env.CLIENT_URL, // Ensure this matches your frontend URL exactly (no trailing slash)
    credentials: true,              // allow cookies
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

// --- NEW RATE LIMITER CONFIGURATION ---

const isProduction = process.env.NODE_ENV === "production";

// 1. Global Limiter (General API use)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // Strict in Prod (100), Relaxed in Dev (1000)
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Too many requests, please try again later." },
});
app.use(globalLimiter);

// 2. Strict Auth Limiter (Login/Register/OTP)
// Prevents brute-force attacks
const authLimiter = rateLimit({
  windowMs: isProduction ? 15 * 60 * 1000 : 60 * 1000, // 15 mins in Prod, 1 min in Dev
  max: isProduction ? 5 : 50, // 5 attempts in Prod, 50 in Dev
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Too many login attempts. Please try again in 15 minutes." },
});

// Apply strict limits to sensitive routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register/request-otp", authLimiter);
app.use("/api/auth/register/verify-otp", authLimiter);
app.use("/api/auth/register/complete", authLimiter); // Added this one too
app.use("/api/auth/forgot/request-otp", authLimiter);

// =========================================
// END SECURITY
// =========================================

// standard middlewares
app.use(express.json());
app.use(cookieParser());

// CSRF protection (must be after cookieParser, before routes)
app.use(csrfProtection);

// ✅ Endpoint to give the frontend a fresh CSRF token (as per Step A)
app.get("/api/csrf-token", (req, res) => {
  res.json({ csrfToken: req.cookies.csrf_token });
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/chapters", chapterRoutes); // <-- Line B added

// simple health route to test server
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Hisaab-Kitaab backend is running",
  });
});

// =========================================
// ✅ STATIC FILE SERVING (for Render deployment)
// =========================================
// Serve static files from the 'client' directory
app.use(express.static(path.join(__dirname, "../client")));

// Handle SPA / Fallback (for direct links like /dashboard.html)
// Using Express 5-safe wildcard
app.get(/(.*)/, (req, res) => {
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
