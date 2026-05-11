require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const compression = require("compression");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = rateLimit;
const logger = require("./middleware/logger");
const csrfProtection = require("./middleware/csrfMiddleware");
const db = require("./config/db");

// ── EXISTING ROUTES ───────────────────────────────────────────
const authRoutes = require("./routes/authRoutes");
const chapterRoutes = require("./routes/chapterRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const friendRoutes = require("./routes/friendRoutes");

// ── NEW ROUTES (Features 4) ───────────────────────────────────
const categoryRoutes = require("./routes/categoryRoutes");

const app = express();

app.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

const isProduction = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);
app.use(logger);

// ── CORS (identical to original) ─────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "https://hisaab-kitaab.onrender.com",
  "https://hisaab-kitaab-q9e1.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`⚠️ CORS Blocked Origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// ── SECURITY (identical to original) ─────────────────────────
app.use(compression());

// ── Step 2.9: Additional Security Headers ────────────────────
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(helmet({
 contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "https://accounts.google.com",
      "https://apis.google.com",
      "https://www.gstatic.com",
    ],
    frameSrc: [
      "'self'",
      "https://accounts.google.com",
    ],
    connectSrc: [
      "'self'",
      "https://accounts.google.com",
      "https://www.googleapis.com",
    ],
    imgSrc: [
      "'self'",
      "data:",
      "https://lh3.googleusercontent.com",
      "https://www.gstatic.com",
    ],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    frameAncestors: ["'self'"],
  },
},
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// ── RATE LIMITING (identical to original) ────────────────────
const rateLimitHandler = (req, res, next, options) => {
  const retryAfter = Math.ceil(options.resetTime / 1000) - Math.floor(Date.now() / 1000);
  console.warn(`⚠️ Rate Limit Hit: IP=${req.ip} | Path=${req.originalUrl}`);
  res.setHeader("Retry-After", retryAfter > 0 ? retryAfter : 60);
  res.status(options.statusCode).json({
    ok: false,
    message: options.message.message || "Too many requests, please try again later.",
    retryAfter: retryAfter > 0 ? retryAfter : 60,
    isRateLimit: true
  });
};

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 500 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "Too many requests, please try again later." },
  keyGenerator: (req) => {
    // At middleware level req.user may not be populated yet.
    // Parse JWT manually here without throwing.
    try {
      const token = req.cookies?.auth_token;
      if (token) {
        const jwt = require("jsonwebtoken");
        const payload = jwt.decode(token); // decode only, no verify (fast)
        if (payload?.userId) return String(payload.userId);
      }
    } catch (_) { /* fall through */ }
    const forwarded = req.headers["x-forwarded-for"];
    return forwarded ? forwarded.split(",")[0].trim() : (req.ip || "unknown");
  }
});
app.use((req, res, next) => {
  if (req.path === '/ping') return next();
  globalLimiter(req, res, next);
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "Too many login attempts. Try again in 15 mins." },
  keyGenerator: (req) => {
    // At middleware level req.user may not be populated yet.
    // Parse JWT manually here without throwing.
    try {
      const token = req.cookies?.auth_token;
      if (token) {
        const jwt = require("jsonwebtoken");
        const payload = jwt.decode(token); // decode only, no verify (fast)
        if (payload?.userId) return String(payload.userId);
      }
    } catch (_) { /* fall through */ }
    const forwarded = req.headers["x-forwarded-for"];
    return forwarded ? forwarded.split(",")[0].trim() : (req.ip || "unknown");
  }
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/login/otp-request", authLimiter);
app.use("/api/auth/login/otp-verify", authLimiter);
app.use("/api/auth/register/request-otp", authLimiter);
app.use("/api/auth/register/verify-otp", authLimiter);
app.use("/api/auth/register/complete", authLimiter);
app.use("/api/auth/forgot/request-otp", authLimiter);
app.use("/api/auth/forgot/reset", authLimiter);
app.use("/api/auth/google", authLimiter);
// NOTE: /api/auth/me, /api/auth/logout, /api/auth/check-identifier deliberately excluded

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 30 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "You're adding expenses too fast, please wait a moment." },
  keyGenerator: (req) => {
    // At middleware level req.user may not be populated yet.
    // Parse JWT manually here without throwing.
    try {
      const token = req.cookies?.auth_token;
      if (token) {
        const jwt = require("jsonwebtoken");
        const payload = jwt.decode(token); // decode only, no verify (fast)
        if (payload?.userId) return String(payload.userId);
      }
    } catch (_) { /* fall through */ }
    const forwarded = req.headers["x-forwarded-for"];
    return forwarded ? forwarded.split(",")[0].trim() : (req.ip || "unknown");
  },
  skipSuccessfulRequests: false,
});

app.use("/api/chapters", (req, res, next) => {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return writeLimiter(req, res, next);
  next();
});
app.use("/api/expenses", (req, res, next) => {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return writeLimiter(req, res, next);
  next();
});

// ✅ NEW: Apply write limiter to categories mutations
app.use("/api/categories", (req, res, next) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) return writeLimiter(req, res, next);
  next();
});

const readHeavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 60 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "Too many requests, please wait a moment." },
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req)
});
app.use("/api/expenses/chapter/:chapterId/settlements", readHeavyLimiter);
app.use("/api/expenses/chapter/:chapterId/summary", readHeavyLimiter);

// ── EXPORT ENDPOINT RATE LIMIT (Step 2.6) ────────────────────
const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 5 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "Please wait before downloading another report." },
  keyGenerator: (req) => {
    try {
      const token = req.cookies?.auth_token;
      if (token) {
        const jwt = require("jsonwebtoken");
        const payload = jwt.decode(token);
        if (payload?.userId) return String(payload.userId);
      }
    } catch (_) {}
    return req.ip || "unknown";
  }
});
app.use("/api/chapters/:id/export", exportLimiter);

// ── MIDDLEWARE (identical to original) ───────────────────────
app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {  // Authenticated routes vary by cookie — critical for any CDN layer
  res.setHeader('Vary', 'Cookie, Accept-Encoding');
  next();
});
app.use((req, res, next) => {  if (req.path === '/ping') return next();
  csrfProtection(req, res, next);
});

// ── CONFIG ENDPOINT (identical to original) ──────────────────
app.get("/api/config", (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID });
});

// ── ROUTES ───────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/chapters", chapterRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/friends", friendRoutes);

// ✅ NEW route registrations
app.use("/api/categories", categoryRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "System operational" });
});

app.use("/api", (req, res) => {
  res.status(404).json({ ok: false, message: "API endpoint not found" });
});

app.use(express.static(path.join(__dirname, "../client")));
app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// ── OTP CLEANUP (identical to original) ──────────────────────
setInterval(async () => {
  try {
    await db.query("DELETE FROM otps WHERE expires_at < NOW()");
    console.log("🧹 Cleaned up expired OTPs");
  } catch (err) {
    console.error("❌ OTP Cleanup Error:", err);
  }
}, 60 * 60 * 1000);

// ── GRACEFUL SHUTDOWN (identical to original) ─────────────────
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  try {
    if (db.pool) { await db.pool.end(); console.log("🔌 Database connection pool closed"); }
    process.exit(0);
  } catch (err) { console.error("❌ Error during shutdown:", err); process.exit(1); }
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  try {
    if (db.pool) { await db.pool.end(); console.log("🔌 Database connection pool closed"); }
    process.exit(0);
  } catch (err) { console.error("❌ Error during shutdown:", err); process.exit(1); }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`⚡ Rate Limits: Global=${isProduction ? 100 : 1000}/15min | Write=${isProduction ? 30 : 100}/min`);
});