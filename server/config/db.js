/* server/config/db.js */
const { Pool } = require("pg");

// =========================================
// 1. STRICT ENV VALIDATION (Fail Fast)
// =========================================
const requiredEnv = [
  "DATABASE_URL",
  "JWT_SECRET",
  "CLIENT_URL",
  "GOOGLE_CLIENT_ID", // Auth-related, needed for safety
];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error("❌ CRITICAL ERROR: Missing Environment Variables:");
  missingEnv.forEach((key) => console.error(`   - ${key}`));
  process.exit(1); // Stop the server immediately
}

// =========================================
// 2. DATABASE CONNECTION POOLING
// =========================================
const connectionString = process.env.DATABASE_URL;

// Detect cloud DBs by URL and force SSL for them
const isCloudDb =
  connectionString &&
  (connectionString.includes("render") ||
    connectionString.includes("neon") ||
    connectionString.includes("aws"));

const sslConfig = { rejectUnauthorized: false }; // Required for most cloud DBs

const pool = new Pool({
  connectionString: connectionString,
  // FORCE SSL for cloud DBs, disable for localhost-style URLs
  ssl: isCloudDb ? sslConfig : false,

  // ✅ Connection Pooling Limits
  max: 20, // Max clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Error if connection takes > 10 seconds
});

// ✅ Retry-enabled query function (up to 3 attempts)
async function query(text, params) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (err) {
      const isConnectionError =
        err.code === "ECONNREFUSED" ||
        err.code === "57P01" ||
        (typeof err.message === "string" && err.message.includes("timeout"));

      if (attempt === 3 || !isConnectionError) {
        console.error(`❌ Database Error (Attempt ${attempt}):`, err.message);
        throw err; // Give up after 3 tries or non-connection error
      }

      console.log(`Database waking up (Attempt ${attempt})...`);
      await new Promise((res) => setTimeout(res, 1000)); // Wait 1 second
    }
  }
}

module.exports = {
  query,
};
