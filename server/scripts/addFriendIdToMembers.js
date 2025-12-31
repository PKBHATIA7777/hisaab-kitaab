/* server/scripts/addFriendIdToMembers.js */
const path = require("path");
// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function migrate() {
  console.log("🏗️  Linking Chapter Members to Friends Table...");

  try {
    // 1. Add friend_id column
    // nullable: because manual members (not from friends list) won't have this
    // ON DELETE SET NULL: If you delete a friend, we keep the chapter member history, just unlink them.
    await db.query(`
      ALTER TABLE chapter_members 
      ADD COLUMN IF NOT EXISTS friend_id INTEGER REFERENCES friends(id) ON DELETE SET NULL;
    `);
    
    // 2. Add Index for performance (Crucial for the profile "Settlements" lookup)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_chapter_members_friend_id ON chapter_members(friend_id);
    `);

    console.log("✅ Migration Successful: 'friend_id' column added to 'chapter_members'.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    process.exit();
  }
}

migrate();