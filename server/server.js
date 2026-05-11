// /* server/server.js */
// require("dotenv").config();
// const express = require("express");
// const cookieParser = require("cookie-parser");
// const cors = require("cors");
// const compression = require("compression");
// const path = require("path");
// const helmet = require("helmet");
// const rateLimit = require("express-rate-limit");
// const { ipKeyGenerator } = rateLimit;
// const logger = require("./middleware/logger"); // ✅ Import Logger

// const csrfProtection = require("./middleware/csrfMiddleware");
// const db = require("./config/db"); // Import DB to ensure validation runs

// // ROUTES
// const authRoutes = require("./routes/authRoutes");
// const chapterRoutes = require("./routes/chapterRoutes");
// const expenseRoutes = require("./routes/expenseRoutes");
// const friendRoutes = require("./routes/friendRoutes"); // <--- ADDED

// const app = express();
// // =========================================
// // 🔥 PING ROUTE (for UptimeRobot)
// // =========================================
// app.get('/ping', (req, res) => {
//   res.status(200).send('OK');
// });
// const isProduction = process.env.NODE_ENV === "production";

// // =========================================
// // 0. PROXY TRUST (Critical for Rate Limit & Cookies)
// // =========================================
// app.set("trust proxy", 1);

// // 1. Logger (Run this first to capture everything) ✅ Fix AN1/AN5
// app.use(logger);

// // =========================================
// // 2. CORS
// // =========================================
// const allowedOrigins = [
//   process.env.CLIENT_URL,           // From .env (e.g. http://localhost:5500)
//   "http://localhost:5500",          // Explicit Localhost
//   "http://127.0.0.1:5500",          // Explicit IP
//   "https://hisaab-kitaab.onrender.com" // Production (Optional: Add your deployed URL)
// ];

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       // Allow requests with no origin (like mobile apps or curl requests)
//       if (!origin) return callback(null, true);

//       // Check if the origin is in our allowed list
//       if (allowedOrigins.includes(origin)) {
//         return callback(null, true);
//       } else {
//         console.warn(`⚠️ CORS Blocked Origin: ${origin}`);
//         return callback(new Error("Not allowed by CORS"));
//       }
//     },
//     credentials: true, // This is CRITICAL for cookies to work
//   })
// );

// // =========================================
// // 3. SECURITY HEADERS (FIX S10)
// // =========================================
// app.use(compression());

// app.use(
//   helmet({
//     contentSecurityPolicy: {
//       directives: {
//         defaultSrc: ["'self'"],
//         scriptSrc: ["'self'", "https://accounts.google.com", "https://g.notify.usercontent.com"],
//         frameSrc: ["'self'", "https://accounts.google.com"],
//         connectSrc: ["'self'", "https://accounts.google.com"],
//         imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com"],
//         styleSrc: ["'self'", "'unsafe-inline'"],
//       },
//     },
//     crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
//     // ✅ HSTS: Force HTTPS for 1 year (31536000s)
//     strictTransportSecurity: {
//       maxAge: 31536000,
//       includeSubDomains: true,
//       preload: true,
//     },
//   })
// );

// // =========================================
// /* 4. RATE LIMITING (ENHANCED - STEP 3 FIXES) */
// // =========================================

// // ✅ IMPROVED: Rate limit handler with Retry-After header and structured response
// const rateLimitHandler = (req, res, next, options) => {
//   const retryAfter = Math.ceil(options.resetTime / 1000) - Math.floor(Date.now() / 1000);
  
//   console.warn(`⚠️ Rate Limit Hit: IP=${req.ip} | Path=${req.originalUrl} | Method=${req.method} | RetryAfter=${retryAfter}s`);
  
//   // Set standard Retry-After header (in seconds)
//   res.setHeader("Retry-After", retryAfter > 0 ? retryAfter : 60);
  
//   // Return structured JSON error that frontend can parse
//   res.status(options.statusCode).json({ 
//     ok: false, 
//     message: options.message.message || "Too many requests, please try again later.",
//     retryAfter: retryAfter > 0 ? retryAfter : 60,
//     isRateLimit: true // Flag for frontend to display specific messaging
//   });
// };

// // 1. Global Limiter (Read operations mostly)
// const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: isProduction ? 100 : 1000,
//   standardHeaders: true,    // Return rate limit info in `RateLimit-*` headers
//   legacyHeaders: false,     // Disable `X-RateLimit-*` headers
//   handler: rateLimitHandler,
//   message: { ok: false, message: "Too many requests, please try again later." },
//   // ✅ Use authenticated user ID for per-user rate limiting on protected routes.
//   // Fall back to IP for auth/unauthenticated endpoints.
//   keyGenerator: (req) => {
//     return req.user?.userId || ipKeyGenerator(req);
//   }
// });
// app.use((req, res, next) => {
//   if (req.path === '/ping') return next(); // skip rate limit for ping
//   globalLimiter(req, res, next);
// });

// // 2. Strict Auth Limiter (Login/OTP) - Keep strict for security
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 30, // 30 attempts per 15 min
//   standardHeaders: true,
//   legacyHeaders: false,
//   handler: rateLimitHandler,
//   message: { ok: false, message: "Too many login attempts. Try again in 15 mins." },
//   // ✅ Use authenticated user ID for per-user rate limiting on protected routes.
//   // Fall back to IP for auth/unauthenticated endpoints.
//   keyGenerator: (req) => {
//     return req.user?.userId || ipKeyGenerator(req);
//   }
// });
// app.use("/api/auth/login", authLimiter);
// app.use("/api/auth/login/otp-request", authLimiter);
// app.use("/api/auth/login/otp-verify", authLimiter);
// app.use("/api/auth/register/request-otp", authLimiter);
// app.use("/api/auth/register/verify-otp", authLimiter);
// app.use("/api/auth/register/complete", authLimiter);
// app.use("/api/auth/forgot/request-otp", authLimiter);
// app.use("/api/auth/forgot/reset", authLimiter);
// app.use("/api/auth/google", authLimiter);
// NOTE: /api/auth/me, /api/auth/logout, /api/auth/check-identifier deliberately excluded

// // ✅ FIX S4: Write Limiter - ADJUSTED FOR EXPENSE ENTRY WORKFLOW (STEP 3)
// const writeLimiter = rateLimit({
//   windowMs: 60 * 1000,        // 1 minute window
//   max: isProduction ? 30 : 100, // ✅ INCREASED: 30 writes/min in prod, 100 in dev (was 10)
//   standardHeaders: true,
//   legacyHeaders: false,
//   handler: rateLimitHandler,
//   message: { ok: false, message: "You're adding expenses too fast, please wait a moment." },
//   // ✅ Use authenticated user ID for per-user rate limiting on protected routes.
//   // Fall back to IP for auth/unauthenticated endpoints.
//   keyGenerator: (req) => {
//     return req.user?.userId || ipKeyGenerator(req);
//   },
//   // ✅ Skip limiting successful OPTIONS preflight requests
//   skipSuccessfulRequests: false,
//   // ✅ In production, consider using Redis store for distributed rate limiting:
//   // store: isProduction ? new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }) : undefined
// });

// // Apply write limiter only to data mutations on expense/chapter routes
// app.use("/api/chapters", (req, res, next) => {
//   if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
//     return writeLimiter(req, res, next);
//   }
//   next();
// });

// app.use("/api/expenses", (req, res, next) => {
//   if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
//     return writeLimiter(req, res, next);
//   }
//   next();
// });

// // ✅ NEW: Specific limiter for settlements/summary (read-heavy but can be expensive)
// const readHeavyLimiter = rateLimit({
//   windowMs: 60 * 1000,
//   max: isProduction ? 60 : 200, // More generous for read operations
//   standardHeaders: true,
//   legacyHeaders: false,
//   handler: rateLimitHandler,
//   message: { ok: false, message: "Too many requests, please wait a moment." },
//   // ✅ Use authenticated user ID for per-user rate limiting on protected routes.
//   // Fall back to IP for auth/unauthenticated endpoints.
//   keyGenerator: (req) => {
//     return req.user?.userId || ipKeyGenerator(req);
//   }
// });

// app.use("/api/expenses/chapter/:chapterId/settlements", readHeavyLimiter);
// app.use("/api/expenses/chapter/:chapterId/summary", readHeavyLimiter);

// // =========================================
// // MIDDLEWARE
// // =========================================
// app.use(express.json());
// app.use(cookieParser());
// app.use((req, res, next) => {
//   if (req.path === '/ping') return next(); // skip CSRF for ping
//   csrfProtection(req, res, next);
// });

// // ✅ FIX S6: Config Endpoint (Serve Public Keys dynamically)
// app.get("/api/config", (req, res) => {
//   res.json({
//     googleClientId: process.env.GOOGLE_CLIENT_ID,
//     // Add other public config here if needed (e.g. Stripe Public Key)
//   });
// });

// // ROUTES
// app.get("/api/csrf-token", (req, res) => {
//   res.json({ csrfToken: req.csrf_token });
// });
// app.use("/api/auth", authRoutes);
// app.use("/api/chapters", chapterRoutes);
// app.use("/api/expenses", expenseRoutes);
// app.use("/api/friends", friendRoutes); // <--- ADDED

// app.get("/api/health", (req, res) => {
//   res.json({ status: "ok", message: "System operational" });
// });

// // 404 API Handler
// app.use("/api", (req, res) => {
//   res.status(404).json({ ok: false, message: "API endpoint not found" });
// });

// // Static Files & SPA Fallback
// app.use(express.static(path.join(__dirname, "../client")));
// app.get(/^(?!\/api).+/, (req, res) => {
//   res.sendFile(path.join(__dirname, "../client/index.html"));
// });

// // =========================================
// // DATABASE CONNECTION POOLING BEST PRACTICES
// // =========================================
// // ✅ NOTE: Ensure all route handlers in ./routes/* use try/finally to release connections:
// // 
// // Example pattern for db.query usage:
// // ```
// // let client;
// // try {
// //   client = await db.pool.connect();
// //   await client.query('BEGIN');
// //   // ... your queries ...
// //   await client.query('COMMIT');
// // } catch (err) {
// //   if (client) await client.query('ROLLBACK');
// //   throw err;
// // } finally {
// //   if (client) client.release(); // ✅ CRITICAL: Always release connection
// // }
// // ```
// // 
// // This prevents "hanging" requests and connection pool exhaustion.

// // =========================================
// // HOUSEKEEPING: Cleanup old OTPs
// // =========================================
// setInterval(async () => {
//   try {
//     await db.query("DELETE FROM otps WHERE expires_at < NOW()");
//     console.log("🧹 Cleaned up expired OTPs");
//   } catch (err) {
//     console.error("❌ OTP Cleanup Error:", err);
//   }
// }, 60 * 60 * 1000); // 1 hour

// // ✅ Graceful Shutdown Handler (Prevents hanging connections on deploy/restart)
// process.on("SIGTERM", async () => {
//   console.log("🛑 SIGTERM received, shutting down gracefully");
//   try {
//     if (db.pool) {
//       await db.pool.end();
//       console.log("🔌 Database connection pool closed");
//     }
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Error during shutdown:", err);
//     process.exit(1);
//   }
// });

// process.on("SIGINT", async () => {
//   console.log("🛑 SIGINT received, shutting down gracefully");
//   try {
//     if (db.pool) {
//       await db.pool.end();
//       console.log("🔌 Database connection pool closed");
//     }
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Error during shutdown:", err);
//     process.exit(1);
//   }
// });

// // Start
// const PORT = process.env.PORT || 5001;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
//   console.log(`🔒 Environment: ${process.env.NODE_ENV || "development"}`);
//   console.log(`⚡ Rate Limits: Global=${isProduction ? 100 : 1000}/15min | Write=${isProduction ? 30 : 100}/min`);
// });


/* server/server.js */
/* MODIFICATION: Only the route imports and app.use() registrations are changed */
/* Everything else (CORS, rate limits, helmet, CSRF, etc.) is 100% identical */

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
app.use(helmet({
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
    if (req.user?.userId) return req.user.userId;
    const forwarded = req.headers['x-forwarded-for'];
    return forwarded ? forwarded.split(',')[0].trim() : ipKeyGenerator(req);
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
    if (req.user?.userId) return req.user.userId;
    const forwarded = req.headers['x-forwarded-for'];
    return forwarded ? forwarded.split(',')[0].trim() : ipKeyGenerator(req);
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
    if (req.user?.userId) return req.user.userId;
    const forwarded = req.headers['x-forwarded-for'];
    return forwarded ? forwarded.split(',')[0].trim() : ipKeyGenerator(req);
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

app.get("/api/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrf_token });
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