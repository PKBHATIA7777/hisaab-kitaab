const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // required by many managed Postgres providers
  },
});

async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

module.exports = {
  query,
};
