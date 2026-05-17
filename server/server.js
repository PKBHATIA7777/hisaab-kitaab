require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const compression = require("compression");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = rateLimit;
// ── STEP 17: Logging Infrastructure Upgrade ─────────────────
// REMOVED: const logger = require("./middleware/logger");
const httpLogger = require("./middleware/httpLogger");
const csrfProtection = require("./middleware/csrfMiddleware");
const db = require("./config/db");
const log = require("./utils/logger"); // For structured logging in cleanup jobs & controllers

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
// ── STEP 17: Replace legacy logger with structured httpLogger ─────────────────
app.use(httpLogger);

// ── CORS (FIX v2: Enhanced for credentialed cross-origin requests) ─────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "https://hisaab-kitaab.onrender.com",
  "https://hisaab-kitaab-q9e1.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any vercel.app subdomain for preview deployments
    if (origin && origin.endsWith('.vercel.app')) return callback(null, true);
    log.warn({ origin }, "CORS Blocked Origin");
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
  exposedHeaders: ['X-CSRF-Token', 'Retry-After'],
  optionsSuccessStatus: 204, // Some old browsers choke on 200 for OPTIONS
  maxAge: 86400, // Cache preflight for 24 hours
}));

// Handle preflight for all routes explicitly
app.options(/.*/, cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin && origin.endsWith('.vercel.app')) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
  exposedHeaders: ['X-CSRF-Token'],
  optionsSuccessStatus: 204,
  maxAge: 86400,
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
        // 'unsafe-inline' removed after script extraction
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
      // CSP violation reporting endpoint
      reportUri: ["/api/csp-report"],
    },
    // Modern report-to directive (also keep report-uri for broader compatibility)
    reportTo: "csp-endpoint",
  },
  // Configure the report-to endpoint for modern browsers
  reportTo: {
    endpoints: [
      {
        group: "csp-endpoint",
        url: "/api/csp-report",
        include_subdomains: true,
        max_age: 3600,
      },
    ],
  },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// ── CSP VIOLATION REPORTING ENDPOINT ─────────────────────────
// ADD before route registrations to capture CSP violations
app.post("/api/csp-report", express.json({ type: "application/csp-report" }), (req, res) => {
  // Log CSP violations for monitoring
  if (req.body && req.body["csp-report"]) {
    log.warn({ cspReport: req.body["csp-report"] }, "CSP Violation");
    // In production, send to your monitoring service (Datadog, Sentry, etc.)
    // Example: sentry.captureMessage(JSON.stringify(req.body["csp-report"]), { level: 'warning' });
  }
  res.status(204).end();
});

// ── RATE LIMITING (SECURITY FIX AUTH-002: Remove unverified jwt.decode()) ────────────────────
const rateLimitHandler = (req, res, next, options) => {
  const retryAfter = Math.ceil(options.resetTime / 1000) - Math.floor(Date.now() / 1000);
  log.warn({ ip: req.ip, path: req.originalUrl, retryAfter }, "Rate Limit Hit");
  res.setHeader("Retry-After", retryAfter > 0 ? retryAfter : 60);
  res.status(options.statusCode).json({
    ok: false,
    message: options.message.message || "Too many requests, please try again later.",
    retryAfter: retryAfter > 0 ? retryAfter : 60,
    isRateLimit: true
  });
};

// GLOBAL LIMITER: Use IP only — no unverified JWT claims
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 500 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "Too many requests, please try again later." },
  keyGenerator: (req) => {
    // Use Vercel's verified IP header (set by trusted proxy)
    // app.set("trust proxy", 1) ensures req.ip is the real client IP
    // X-Forwarded-For is already unwrapped correctly by Express
    return req.ip || "unknown";
  }
});
app.use((req, res, next) => {
  if (req.path === '/ping') return next();
  globalLimiter(req, res, next);
});

// ── PHASE 5: PRODUCTION INFRASTRUCTURE ───────────────────────
// STEP 16 — Rate Limit Fixes (CROSS-003): Per-email OTP limiter
// ADD a Map-based per-email OTP limiter (no extra library needed):
const otpEmailLimiter = (() => {
  const attempts = new Map(); // email → { count, resetAt }
  const MAX = 5;
  const WINDOW = 15 * 60 * 1000; // 15 min

  return (req, res, next) => {
    // Only apply to OTP request endpoints
    const email = (req.body?.email || "").toLowerCase().trim();
    if (!email) return next();

    const now = Date.now();
    const record = attempts.get(email);

    if (record && now < record.resetAt) {
      if (record.count >= MAX) {
        log.warn({ email, count: record.count }, "OTP rate limit exceeded per email");
        return res.status(429).json({
          ok: false,
          message: "Too many code requests for this email. Please wait 15 minutes.",
        });
      }
      record.count++;
    } else {
      attempts.set(email, { count: 1, resetAt: now + WINDOW });
    }

    next();
  };
})();

// Apply to OTP request routes (BEFORE authLimiter):
app.use("/api/auth/register/request-otp", otpEmailLimiter);
app.use("/api/auth/login/otp-request", otpEmailLimiter);
app.use("/api/auth/forgot/request-otp", otpEmailLimiter);
// ── END PHASE 5 STEP 16 ──────────────────────────────────────

// AUTH LIMITER: Use IP only — login/register endpoints have no verified user yet
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "Too many login attempts. Try again in 15 mins." },
  keyGenerator: (req) => {
    // Use verified IP address only — never trust unverified JWT claims
    return req.ip || "unknown";
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

// WRITE LIMITER: Runs AFTER requireAuth middleware — req.user is cryptographically verified
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 30 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "You're adding expenses too fast, please wait a moment." },
  keyGenerator: (req) => {
    // req.user is set by requireAuth middleware — cryptographically verified
    if (req.user && req.user.userId) return `user:${req.user.userId}`;
    return req.ip || "unknown";
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

// ✅ ADD middleware to handle idempotency keys for expense creation:
// This prevents duplicate expenses if the retry fires after a partially successful request
app.use("/api/expenses", (req, res, next) => {
  const key = req.headers["x-idempotency-key"];
  if (key && ["POST"].includes(req.method)) {
    req.idempotencyKey = key;
  }
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

// ── EXPORT ENDPOINT RATE LIMIT (SECURITY FIX AUTH-002) ────────────────────
// Export endpoint runs after requireAuth, so req.user is safe to use
const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 5 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "Please wait before downloading another report." },
  keyGenerator: (req) => {
    // req.user is set by requireAuth middleware — cryptographically verified
    if (req.user && req.user.userId) return `user:${req.user.userId}`;
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

// 🔍 STEP 23 — Enhanced Health Check & Readiness Probe
app.get("/api/health", async (req, res) => {
  const checks = { status: "ok", timestamp: new Date().toISOString() };

  // DB connectivity check
  try {
    await db.query("SELECT 1");
    checks.database = "ok";
  } catch (err) {
    checks.database = "error";
    checks.status = "degraded";
    log.error({ err }, "Health check: Database connection failed");
  }

  // Optional: Add more checks here (Redis, external APIs, etc.)
  // Example:
  // try {
  //   await redis.ping();
  //   checks.redis = "ok";
  // } catch (err) {
  //   checks.redis = "error";
  //   checks.status = "degraded";
  // }

  const statusCode = checks.status === "ok" ? 200 : 503;
  res.status(statusCode).json(checks);
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
    log.info({}, "Cleaned up expired OTPs");
  } catch (err) {
    log.error({ err }, "OTP Cleanup Error");
  }
}, 60 * 60 * 1000);

// ── STEP 18: Refresh Token Cleanup Job ───────────────────────
// Runs every 6 hours to remove expired or revoked refresh tokens
setInterval(async () => {
  try {
    const { rows } = await db.query(
      "DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = TRUE RETURNING id"
    );
    if (rows.length > 0) {
      log.info({ count: rows.length }, "Cleaned up expired/revoked refresh tokens");
    }
  } catch (err) {
    log.error({ err }, "Refresh token cleanup error");
  }
}, 6 * 60 * 60 * 1000); // Every 6 hours
// ── END STEP 18 ─────────────────────────────────────────────

// ── GRACEFUL SHUTDOWN (identical to original) ─────────────────
process.on("SIGTERM", async () => {
  log.info({}, "SIGTERM received, shutting down gracefully");
  try {
    if (db.pool) { await db.pool.end(); log.info({}, "Database connection pool closed"); }
    process.exit(0);
  } catch (err) { 
    log.error({ err }, "Error during shutdown"); 
    process.exit(1); 
  }
});

process.on("SIGINT", async () => {
  log.info({}, "SIGINT received, shutting down gracefully");
  try {
    if (db.pool) { await db.pool.end(); log.info({}, "Database connection pool closed"); }
    process.exit(0);
  } catch (err) { 
    log.error({ err }, "Error during shutdown"); 
    process.exit(1); 
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`⚡ Rate Limits: Global=${isProduction ? 100 : 1000}/15min | Write=${isProduction ? 30 : 100}/min`);
  log.info({ port: PORT, env: process.env.NODE_ENV || "development" }, "Server started");
});