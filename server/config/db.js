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

async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

module.exports = {
  query,
};