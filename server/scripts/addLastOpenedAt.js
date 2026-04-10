/* server/scripts/addLastOpenedAt.js */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function migrate() {
  console.log("🏗️  Adding last_opened_at to chapters...");
  try {
    await db.query(`
      ALTER TABLE chapters 
      ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMP;
    `);
    // Backfill existing rows with created_at so sort works immediately
    await db.query(`
      UPDATE chapters SET last_opened_at = created_at WHERE last_opened_at IS NULL;
    `);
    console.log("✅ Done.");
  } catch (err) {
    console.error("❌ Failed:", err.message);
  } finally {
    process.exit();
  }
}
migrate();