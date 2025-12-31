/* server/scripts/repairDb.js */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function repairDatabase() {
  console.log("🔧 Starting Database Repair...");

  try {
    // 1. Fix 'chapter_members' table (Add friend_id)
    console.log("👉 Checking 'chapter_members' table...");
    await db.query(`
      ALTER TABLE chapter_members 
      ADD COLUMN IF NOT EXISTS friend_id INTEGER REFERENCES friends(id) ON DELETE SET NULL;
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_chapter_members_friend_id ON chapter_members(friend_id);
    `);
    console.log("   ✅ 'friend_id' column verified.");

    // 2. Fix 'chapter_members' table (Add user_id if missing)
    await db.query(`
      ALTER TABLE chapter_members 
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);
    console.log("   ✅ 'user_id' column verified.");

    // 3. Fix 'users' table (Make username nullable)
    console.log("👉 Checking 'users' table...");
    await db.query(`
      ALTER TABLE users 
      ALTER COLUMN username DROP NOT NULL;
    `);
    console.log("   ✅ 'username' constraint verified.");

    // 4. Verify Expense Tables
    console.log("👉 Checking 'expenses' table...");
    // Check if we are using the old column name "paid_by" or new "payer_member_id"
    // We want "payer_member_id".
    const { rows } = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='expenses' AND column_name='payer_member_id';
    `);

    if (rows.length === 0) {
        console.log("   ⚠️ Missing 'payer_member_id'. Attempting to rename 'paid_by' if it exists...");
        // Try to rename if old one exists, otherwise create
        try {
            await db.query(`ALTER TABLE expenses RENAME COLUMN paid_by TO payer_member_id;`);
            console.log("   ✅ Renamed 'paid_by' to 'payer_member_id'.");
        } catch (e) {
            // If rename fails, maybe column doesn't exist at all?
            console.log("   ℹ️ Rename failed (maybe column didn't exist). ensuring column exists...");
             await db.query(`
                ALTER TABLE expenses 
                ADD COLUMN IF NOT EXISTS payer_member_id INTEGER REFERENCES chapter_members(id) ON DELETE SET NULL;
            `);
        }
    } else {
        console.log("   ✅ 'payer_member_id' column verified.");
    }

    console.log("\n✅ REPAIR COMPLETE. Your database is now synced with the code.");

  } catch (err) {
    console.error("\n❌ Repair Failed:", err.message);
  } finally {
    process.exit();
  }
}

repairDatabase();