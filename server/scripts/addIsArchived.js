/* server/scripts/addIsArchived.js */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function migrate() {
  console.log("🏗️  Adding is_archived to chapters...");
  try {
    await db.query(`
      ALTER TABLE chapters 
      ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
    `);
    console.log("✅ Done.");
  } catch (err) {
    console.error("❌ Failed:", err.message);
  } finally {
    process.exit();
  }
}
migrate();