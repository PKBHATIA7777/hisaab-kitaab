/* server/scripts/updateMembersTable.js */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function migrate() {
  console.log("🏗️  Updating Chapter Members Table...");

  try {
    // 1. Add user_id column (Nullable, because some members might just be names)
    await db.query(`
      ALTER TABLE chapter_members 
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);
    
    // 2. Index for faster lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_chapter_members_user_id ON chapter_members(user_id);
    `);

    console.log("✅ Chapter Members table updated successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    process.exit();
  }
}

migrate();