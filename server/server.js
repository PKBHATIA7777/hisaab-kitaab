// load environment variables first
require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

// --- SECURITY IMPORTS ---
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
// -----------------------

// DB (connection / pool)
const db = require("./config/db");

const authRoutes = require("./routes/authRoutes");

const app = express();

// =========================================
// 1. SECURITY MIDDLEWARES (The Shield)
// =========================================

// Helmet sets security headers to hide server details
app.use(helmet());

// Global Rate Limiter: Allows 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use(globalLimiter);

// Strict Auth Limiter: Only 5 attempts per 15 minutes for login/OTP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: "Too many login/OTP attempts, please try again later.",
});

// Apply strict limits ONLY to sensitive routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register/request-otp", authLimiter);
app.use("/api/auth/register/verify-otp", authLimiter);
app.use("/api/auth/forgot/request-otp", authLimiter);

// =========================================
// END SECURITY
// =========================================

// standard middlewares
app.use(express.json());
app.use(cookieParser());

// configure CORS so frontend can talk to backend
app.use(
  cors({
    origin: process.env.CLIENT_URL, // frontend origin
    credentials: true,              // allow cookies
  })
);

// routes
app.use("/api/auth", authRoutes);

// simple health route to test server
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Hisaab-Kitaab backend is running",
  });
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




// // load environment variables first
// require("dotenv").config();

// const express = require("express");
// const cookieParser = require("cookie-parser");
// const cors = require("cors");

// // just ensure DB module is loaded (connection/pool created inside it)
// require("./config/db");

// const authRoutes = require("./routes/authRoutes");

// const app = express();

// // middlewares
// app.use(express.json());
// app.use(cookieParser());

// // configure CORS so frontend can talk to backend
// app.use(
//   cors({
//     origin: process.env.CLIENT_URL, // frontend origin
//     credentials: true,              // allow cookies
//   })
// );

// // routes
// app.use("/api/auth", authRoutes);

// // simple health route to test server
// app.get("/api/health", (req, res) => {
//   res.json({
//     status: "ok",
//     message: "Hisaab-Kitaab backend is running",
//   });
// });

// const PORT = process.env.PORT || 5001;

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });
