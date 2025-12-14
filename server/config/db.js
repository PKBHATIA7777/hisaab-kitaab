// server/config/db.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render Postgres usually requires SSL:
  ssl: {
    rejectUnauthorized: false,
  },
});

// Simple helper to run queries: db.query(text, params)
async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

module.exports = {
  query,
};
