const { Pool } = require("pg");

// Determine if we need SSL. 
// If we are in production OR if the database URL looks like a cloud URL (contains 'render', 'neon', etc), we force SSL.
const connectionString = process.env.DATABASE_URL;
const sslConfig = { rejectUnauthorized: false }; // Required for most cloud DBs

const pool = new Pool({
  connectionString: connectionString,
  // FORCE SSL: If it's a cloud DB, use SSL. If it's purely local (localhost), no SSL.
  ssl: (connectionString && !connectionString.includes("localhost")) ? sslConfig : false,
});

// ✅ Retry-enabled query function (up to 3 attempts)
async function query(text, params) {
  // Retry up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (err) {
      // If it's a connection error (timeout/refused), wait 1s and retry
      const isConnectionError =
        err.code === "ECONNREFUSED" ||
        err.code === "57P01" ||
        (typeof err.message === "string" && err.message.includes("timeout"));

      if (attempt === 3 || !isConnectionError) {
        console.error("Database failed:", err);
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
