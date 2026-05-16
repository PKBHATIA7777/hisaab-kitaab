const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");
async function migrate() {
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS jwt_generation INTEGER DEFAULT 0 NOT NULL;`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_users_jwt_gen ON users(id, jwt_generation);`);
  console.log("✅ jwt_generation column added");
  process.exit(0);
}
migrate().catch(e => { console.error(e); process.exit(1); });