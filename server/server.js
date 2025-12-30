/* server/server.js */
require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const compression = require("compression");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const logger = require("./middleware/logger"); // ✅ Import Logger

const csrfProtection = require("./middleware/csrfMiddleware");
const db = require("./config/db"); // Import DB to ensure validation runs

// ROUTES
const authRoutes = require("./routes/authRoutes");
const chapterRoutes = require("./routes/chapterRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const friendRoutes = require("./routes/friendRoutes"); // <--- ADDED

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// =========================================
// 0. PROXY TRUST (Critical for Rate Limit & Cookies)
// =========================================
app.set("trust proxy", 1);

// 1. Logger (Run this first to capture everything) ✅ Fix AN1/AN5
app.use(logger);

// =========================================
// 2. CORS
// =========================================
const allowedOrigins = [
  process.env.CLIENT_URL,           // From .env (e.g. http://localhost:5500)
  "http://localhost:5500",          // Explicit Localhost
  "http://127.0.0.1:5500",          // Explicit IP
  "https://hisaab-kitaab.onrender.com" // Production (Optional: Add your deployed URL)
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if the origin is in our allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn(`⚠️ CORS Blocked Origin: ${origin}`);
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // This is CRITICAL for cookies to work
  })
);

// =========================================
// 3. SECURITY HEADERS (FIX S10)
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
    // ✅ HSTS: Force HTTPS for 1 year (31536000s)
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// =========================================
/* 4. RATE LIMITING (ENHANCED) */
// =========================================
const rateLimitHandler = (req, res, next, options) => {
  console.warn(`⚠️ Rate Limit: IP ${req.ip} -> ${req.originalUrl}`);
  res.status(options.statusCode).json(options.message);
};

// 1. Global Limiter (Read operations mostly)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "Too many requests, please try again later." },
});
app.use(globalLimiter);

// 2. Strict Auth Limiter (Login/OTP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "Too many login attempts. Try again in 15 mins." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register/request-otp", authLimiter);
app.use("/api/auth/register/verify-otp", authLimiter);
app.use("/api/auth/register/complete", authLimiter);
app.use("/api/auth/forgot/request-otp", authLimiter);
app.use("/api/auth", authLimiter); // Apply to all auth routes for safety

// ✅ FIX S4: Write Limiter (Spam Protection for Create/Edit/Delete)
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // Max 10 writes per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "You are doing that too fast. Please slow down." }
});

// Apply write limiter only to data mutations
app.use("/api/chapters", (req, res, next) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) {
    return writeLimiter(req, res, next);
  }
  next();
});
app.use("/api/expenses", (req, res, next) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) {
    return writeLimiter(req, res, next);
  }
  next();
});

// =========================================
// MIDDLEWARE
// =========================================
app.use(express.json());
app.use(cookieParser());
app.use(csrfProtection);

// ✅ FIX S6: Config Endpoint (Serve Public Keys dynamically)
app.get("/api/config", (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    // Add other public config here if needed (e.g. Stripe Public Key)
  });
});

// ROUTES
app.get("/api/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrf_token });
});
app.use("/api/auth", authRoutes);
app.use("/api/chapters", chapterRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/friends", friendRoutes); // <--- ADDED

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "System operational" });
});

// 404 API Handler
app.use("/api", (req, res) => {
  res.status(404).json({ ok: false, message: "API endpoint not found" });
});

// Static Files & SPA Fallback
app.use(express.static(path.join(__dirname, "../client")));
app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// =========================================
// HOUSEKEEPING: Cleanup old OTPs
// =========================================
setInterval(async () => {
  try {
    await db.query("DELETE FROM otps WHERE expires_at < NOW()");
    console.log("🧹 Cleaned up expired OTPs");
  } catch (err) {
    console.error("❌ OTP Cleanup Error:", err);
  }
}, 60 * 60 * 1000); // 1 hour

// Start
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || "development"}`);
});
