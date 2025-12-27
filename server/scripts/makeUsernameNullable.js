/* server/scripts/makeUsernameNullable.js */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function migrate() {
  console.log("🏗️  Altering Users Table...");

  try {
    // 1. Drop NOT NULL constraint on username
    await db.query(`
      ALTER TABLE users 
      ALTER COLUMN username DROP NOT NULL;
    `);
    
    // 2. Drop UNIQUE constraint if it exists (optional, but good if we auto-gen duplicates later)
    // Note: Usually we keep unique, but if we auto-gen, we handle uniqueness in code. 
    // For now, just dropping NOT NULL is sufficient for the "remove username field" plan.
    
    console.log("✅ Users table updated: 'username' is now nullable.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    process.exit();
  }
}

migrate();