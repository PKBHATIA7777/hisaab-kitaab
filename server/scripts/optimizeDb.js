/* server/scripts/optimizeDb.js */
const path = require("path");

// Load .env from the server root
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const db = require("../config/db");

async function applyIndexes() {
  console.log("⚡ Starting Database Optimization...");

  const queries = [
    // 1. Users: Speed up login and signup checks
    "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);",
    
    // 2. Users: Speed up username lookups
    "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);",
    
    // 3. Chapters: Speed up 'Get My Chapters' (Critical for Dashboard)
    "CREATE INDEX IF NOT EXISTS idx_chapters_created_by ON chapters(created_by);",
    
    // 4. Chapter Members: Speed up loading members for a chapter
    "CREATE INDEX IF NOT EXISTS idx_chapter_members_chapter_id ON chapter_members(chapter_id);"
  ];

  for (const q of queries) {
    try {
      // Just print the index name for cleaner logs
      const indexName = q.split("EXISTS ")[1].split(" ON")[0];
      await db.query(q);
      console.log(`✅ Verified Index: ${indexName}`);
    } catch (err) {
      console.error(`❌ Failed: ${q}`, err.message);
    }
  }

  console.log("🏁 Database Optimization Complete.");
  process.exit();
}

applyIndexes();