const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");
async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(128) NOT NULL UNIQUE,
      device_hint VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      last_used_at TIMESTAMP DEFAULT NOW(),
      revoked BOOLEAN DEFAULT FALSE
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);`);
  console.log("✅ refresh_tokens table created");
  process.exit(0);
}
migrate().catch(e => { console.error(e); process.exit(1); });