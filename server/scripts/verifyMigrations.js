const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function verify() {
  const checks = [
    { table: "settlement_records", col: null },
    { table: "chapters", col: "is_personal" },
    { table: "chapters", col: "is_archived" },
    { table: "chapters", col: "last_opened_at" },
    { table: "expenses", col: "event_id" },
    { table: "expenses", col: "category_id" },
    { table: "expenses", col: "source_chapter_id" },
    { table: "expenses", col: "is_synced_from_chapter" },
    { table: "expenses", col: "sync_dismissed" },
    { table: "expense_categories", col: null },
    { table: "events", col: null },
    { table: "friends", col: null },
    { table: "chapter_members", col: "friend_id" },
    { table: "chapter_members", col: "user_id" },
    { table: "otps", col: null },
  ];

  for (const c of checks) {
    try {
      if (c.col) {
        await db.query(`SELECT ${c.col} FROM ${c.table} LIMIT 1`);
        console.log(`✅ ${c.table}.${c.col}`);
      } else {
        await db.query(`SELECT 1 FROM ${c.table} LIMIT 1`);
        console.log(`✅ ${c.table}`);
      }
    } catch (e) {
      console.error(`❌ MISSING: ${c.table}${c.col ? '.'+c.col : ''} — ${e.message}`);
    }
  }
  process.exit();
}
verify();