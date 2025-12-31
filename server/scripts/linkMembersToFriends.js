/* server/scripts/linkMembersToFriends.js */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function migrate() {
  console.log("🏗️  Linking Chapter Members to Friends...");

  try {
    // 1. Add friend_id column (Nullable, Foreign Key)
    // This allows us to link a member to a specific friend record.
    await db.query(`
      ALTER TABLE chapter_members 
      ADD COLUMN IF NOT EXISTS friend_id INTEGER REFERENCES friends(id) ON DELETE SET NULL;
    `);
    
    // 2. Index for fast lookups (Needed for "Get Settlements" later)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_chapter_members_friend_id ON chapter_members(friend_id);
    `);

    console.log("✅ Chapter Members table updated: 'friend_id' added.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    process.exit();
  }
}

migrate();