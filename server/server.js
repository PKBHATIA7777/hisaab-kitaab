require("dotenv").config();

// ── SENTRY INITIALIZATION (Must be before anything else) ──────
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  environment: process.env.NODE_ENV || "development",
  enabled: process.env.NODE_ENV !== "test" // Disable in tests to avoid open handles
});

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
const { requireAuth } = require("./middleware/authMiddleware");

// ── EXISTING ROUTES ───────────────────────────────────────────
const authRoutes = require("./routes/authRoutes");
const chapterRoutes = require("./routes/chapterRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const friendRoutes = require("./routes/friendRoutes");

// ── NEW ROUTES (Features 4) ───────────────────────────────────
const categoryRoutes = require("./routes/categoryRoutes");
const inviteRoutes = require("./routes/inviteRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

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
  "http://localhost:5501",
  "http://127.0.0.1:5501",
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
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      styleSrcElem: ["'self'", "https://fonts.googleapis.com"],
      styleSrcAttr: ["'self'", "'unsafe-inline'"],
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
// ADD a Database-backed per-email OTP limiter (survives server restarts):
// Database-backed OTP rate limiter — survives server restarts.
// Uses the existing 'otps' table to count recent OTP requests per email.
// No new tables or packages needed.
async function otpEmailLimiter(req, res, next) {
  const email = (req.body?.email || "").toLowerCase().trim();
  if (!email) return next();

  try {
    // Count OTP requests for this email in the last 15 minutes
    // We count rows in the otps table — each request creates/updates one row.
    // The 'created_at' column tracks when the last OTP was issued.
    const { rows } = await db.query(
      `SELECT COUNT(*) as request_count,
              MAX(created_at) as last_request
       FROM otps
       WHERE email = $1 
         AND created_at > NOW() - INTERVAL '15 minutes'`,
      [email]
    );

    const count = parseInt(rows[0]?.request_count || '0');

    // Allow max 5 OTP requests per email per 15 minutes
    if (count >= 5) {
      const lastRequest = rows[0]?.last_request;
      log.warn({ email, count }, "OTP rate limit exceeded per email (DB-backed)");
      return res.status(429).json({
        ok: false,
        message: "Too many verification code requests. Please wait 15 minutes before trying again.",
        retryAfter: 900 // 15 minutes in seconds
      });
    }

    next();
  } catch (err) {
    // If DB check fails, allow the request through (fail open for OTP)
    // This prevents DB outages from completely blocking login
    log.error({ err, email }, "OTP rate limiter DB check failed — allowing request");
    next();
  }
}

// Apply to OTP request routes (BEFORE authLimiter):
// Note: These are now async middleware — Express 4/5 handles this correctly
app.use(["/api/auth/register/request-otp", "/api/v1/auth/register/request-otp"], otpEmailLimiter);
app.use(["/api/auth/login/otp-request", "/api/v1/auth/login/otp-request"], otpEmailLimiter);
app.use(["/api/auth/forgot/request-otp", "/api/v1/auth/forgot/request-otp"], otpEmailLimiter);
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
app.use(["/api/auth/login", "/api/v1/auth/login"], authLimiter);
app.use(["/api/auth/login/otp-request", "/api/v1/auth/login/otp-request"], authLimiter);
app.use(["/api/auth/login/otp-verify", "/api/v1/auth/login/otp-verify"], authLimiter);
app.use(["/api/auth/register/request-otp", "/api/v1/auth/register/request-otp"], authLimiter);
app.use(["/api/auth/register/verify-otp", "/api/v1/auth/register/verify-otp"], authLimiter);
app.use(["/api/auth/register/complete", "/api/v1/auth/register/complete"], authLimiter);
app.use(["/api/auth/forgot/request-otp", "/api/v1/auth/forgot/request-otp"], authLimiter);
app.use(["/api/auth/forgot/reset", "/api/v1/auth/forgot/reset"], authLimiter);
app.use(["/api/auth/google", "/api/v1/auth/google"], authLimiter);
// NOTE: /api/auth/me, /api/auth/logout deliberately excluded

// CHECK-IDENTIFIER LIMITER: Prevents account enumeration via automated scanning
const identifierLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // More generous than auth (users may typo emails)
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "Too many attempts. Please wait before trying again." },
  keyGenerator: (req) => req.ip || "unknown"
});
app.use(["/api/auth/check-identifier", "/api/v1/auth/check-identifier"], identifierLimiter);

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

app.use(["/api/chapters", "/api/v1/chapters"], (req, res, next) => {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return writeLimiter(req, res, next);
  next();
});
app.use(["/api/expenses", "/api/v1/expenses"], (req, res, next) => {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return writeLimiter(req, res, next);
  next();
});

// ✅ ADD middleware to handle idempotency keys for expense creation:
// This prevents duplicate expenses if the retry fires after a partially successful request
app.use(["/api/expenses", "/api/v1/expenses"], (req, res, next) => {
  const key = req.headers["x-idempotency-key"];
  if (key && ["POST"].includes(req.method)) {
    req.idempotencyKey = key;
  }
  next();
});

// ✅ NEW: Apply write limiter to categories mutations
app.use(["/api/categories", "/api/v1/categories"], (req, res, next) => {
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
app.use(["/api/expenses/chapter/:chapterId/settlements", "/api/v1/expenses/chapter/:chapterId/settlements"], readHeavyLimiter);
app.use(["/api/expenses/chapter/:chapterId/summary", "/api/v1/expenses/chapter/:chapterId/summary"], readHeavyLimiter);

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
app.use(["/api/chapters/:id/export", "/api/v1/chapters/:id/export"], exportLimiter);

// ── MIDDLEWARE (identical to original) ───────────────────────
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());
app.use((req, res, next) => {  // Authenticated routes vary by cookie — critical for any CDN layer
  res.setHeader('Vary', 'Cookie, Accept-Encoding');
  next();
});
app.use((req, res, next) => {
  if (req.path === '/ping') return next();
  csrfProtection(req, res, next);
});

// ── CONFIG ENDPOINT (identical to original) ──────────────────
app.get("/api/v1/config", (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID });
});
app.get("/api/config", (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID });
});

// ── ROUTES ───────────────────────────────────────────────────
// v1 routes (canonical)
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/chapters", chapterRoutes);
app.use("/api/v1/expenses", expenseRoutes);
app.use("/api/v1/friends", friendRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/invites", inviteRoutes);
app.use("/api/v1/notifications", notificationRoutes);

// Backward-compat alias (to be removed later)
app.use("/api/auth", authRoutes);
app.use("/api/chapters", chapterRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/invites", inviteRoutes);
app.use("/api/notifications", notificationRoutes);

// ── WARM UP EMAIL CONNECTION ON STARTUP ──────────────────────
// Import the warmUp function and call it after server starts
const { warmUpEmailConnection } = require("./utils/email");

// ── BASIC OBSERVABILITY METRICS (PHASE-8-STEP-3) ─────────────
// Track request counts and errors for basic observability
const _metrics = {
  requests: 0,
  errors: 0,
  startTime: Date.now(),
  lastOtpSentAt: null,
};

// Increment request counter on every request
app.use((req, res, next) => {
  _metrics.requests++;
  const originalEnd = res.end;
  res.end = function (...args) {
    if (res.statusCode >= 500) _metrics.errors++;
    return originalEnd.apply(this, args);
  };
  next();
});

// 🔍 STEP 23 — Enhanced Health Check & Readiness Probe with Metrics
app.get("/api/health", async (req, res) => {
  let isHealthy = true;
  try {
    await db.query("SELECT 1");
  } catch (err) {
    isHealthy = false;
    log.error({ err }, "Health check: Database connection failed");
  }

  const status = isHealthy ? "ok" : "degraded";
  const statusCode = isHealthy ? 200 : 503;
  res.status(statusCode).json({ status });
});

app.get("/api/health/detailed", requireAuth, async (req, res) => {
  const checks = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - _metrics.startTime) / 1000) + 's',
    requests: _metrics.requests,
    errors: _metrics.errors,
    errorRate: _metrics.requests > 0
      ? (((_metrics.errors / _metrics.requests) * 100).toFixed(2) + '%')
      : '0%',
    memory: (() => {
      const mem = process.memoryUsage();
      return {
        rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
        heap: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
      };
    })(),
  };

  try {
    const start = Date.now();
    await db.query("SELECT 1");
    checks.database = `ok (${Date.now() - start}ms)`;
  } catch (err) {
    checks.database = "error";
    checks.status = "degraded";
    log.error({ err }, "Detailed health check: Database connection failed");
  }

  // Check Neon connection pool
  try {
    const { rows } = await db.query("SELECT COUNT(*) as active FROM pg_stat_activity WHERE state = 'active'");
    checks.dbConnections = rows[0]?.active || 'unknown';
  } catch (_) { }

  const statusCode = checks.status === "ok" ? 200 : 503;
  res.status(statusCode).json(checks);
});

// ── SENTRY EXPRESS ERROR HANDLER ───────────────────────────────
Sentry.setupExpressErrorHandler(app);

// Global Error Handler for API routes
app.use("/api", (err, req, res, next) => {
  log.error({ err }, "Unhandled API Error");
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    ok: false,
    message: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message,
    sentryErrorId: res.sentry || undefined,
  });
});

app.use("/api", (req, res) => {
  res.status(404).json({ ok: false, message: "API endpoint not found" });
});

// ── SERVICE WORKER — Auto cache-bust without a build step ────
// Reads sw.js, appends today's date to CACHE_VERSION so returning users
// always get fresh assets after a deploy. No CI/CD or build tooling needed.
// The date changes at midnight UTC — worst case a user gets stale assets
// for <24h, which is acceptable for this app.
const fs = require("fs");
const swPath = path.join(__dirname, "../client/sw.js");

let cachedSwBase = null;
let lastSwReadTime = 0;
const SW_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function getSwContent() {
  const now = Date.now();
  if (!cachedSwBase || (now - lastSwReadTime > SW_CACHE_DURATION)) {
    try {
      const content = await fs.promises.readFile(swPath, "utf8");
      cachedSwBase = content;
      lastSwReadTime = now;
    } catch (err) {
      if (cachedSwBase) {
        log.warn({ err }, "Failed to re-read sw.js, using stale cache");
      } else {
        throw err;
      }
    }
  }
  return cachedSwBase;
}

app.get("/sw.js", async (req, res) => {
  try {
    let swContent = await getSwContent();
    // Inject today's date into the CACHE_VERSION constant
    // e.g. "v7" becomes "v7-20260524"
    const now = new Date();
    const weekOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
    const today = `${now.getFullYear()}w${weekOfYear}`;
    swContent = swContent.replace(
      /const CACHE_VERSION = "(v\d+)";/,
      `const CACHE_VERSION = "$1-${today}";`
    );
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Service-Worker-Allowed", "/");
    res.send(swContent);
  } catch (err) {
    log.error({ err }, "Failed to serve sw.js");
    res.status(500).send("// Service worker unavailable");
  }
});

app.use(express.static(path.join(__dirname, "../client")));
app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// ── OTP CLEANUP (identical to original) ──────────────────────
if (process.env.NODE_ENV !== 'test') {
  setInterval(async () => {
    try {
      await db.query("DELETE FROM otps WHERE expires_at < NOW()");
      log.info({}, "Cleaned up expired OTPs");
    } catch (err) {
      log.error({ err }, "OTP Cleanup Error");
    }
  }, 60 * 60 * 1000);

  // ── DEVICE SESSION CLEANUP (NEW: Remove stale sessions older than 90 days) ──────────────────────
  // Clean up stale device sessions (older than 90 days)
  setInterval(async () => {
    try {
      await db.query(
        "DELETE FROM device_sessions WHERE last_active_at < NOW() - INTERVAL '90 days'"
      );
      log.info({}, "Cleaned up stale device sessions");
    } catch (err) {
      log.error({ err }, "Device session cleanup error");
    }
  }, 24 * 60 * 60 * 1000); // Daily

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
}
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

if (require.main === module) {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    log.info({ port: PORT }, `Server running on port ${PORT}`);
    log.info({ env: process.env.NODE_ENV || "development" }, `Environment: ${process.env.NODE_ENV || "development"}`);
    log.info(`Rate Limits: Global=${isProduction ? 100 : 1000}/15min | Write=${isProduction ? 30 : 100}/min`);
    log.info({ port: PORT, env: process.env.NODE_ENV || "development" }, "Server started");

    // Warm up email connection in background (non-blocking)
    warmUpEmailConnection().catch(() => { }); // ← ADD THIS LINE ONLY
  });
}

module.exports = app;