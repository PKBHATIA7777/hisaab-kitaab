/* server/scripts/addCollaborativeIndexes.js */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function migrate() {
  console.log("Adding indexes for collaborative features...");
  
  const indexes = [
    // Expenses: Fast retrieval by chapter + date (primary query for collaboration sync)
    `CREATE INDEX IF NOT EXISTS idx_expenses_chapter_date 
     ON expenses(chapter_id, expense_date DESC)`,
    
    // Expenses: Fast retrieval of recently modified expenses (for sync/polling)
    `CREATE INDEX IF NOT EXISTS idx_expenses_chapter_created
     ON expenses(chapter_id, created_at DESC)`,
    
    // Chapter members: Fast lookup for permission checks
    `CREATE INDEX IF NOT EXISTS idx_chapter_members_user_chapter 
     ON chapter_members(user_id, chapter_id)`,
    
    // Settlement records: Fast lookup for active settlements per chapter
    `CREATE INDEX IF NOT EXISTS idx_settlement_records_chapter_status
     ON settlement_records(chapter_id, status)`,
    
    // Device sessions: Fast lookup for active sessions per user
    `CREATE INDEX IF NOT EXISTS idx_device_sessions_user_active
     ON device_sessions(user_id, last_active_at DESC)`,
    
    // Events: Fast lookup for chapter events
    `CREATE INDEX IF NOT EXISTS idx_events_chapter_status
     ON events(chapter_id, status)`,
  ];
  
  let success = 0;
  for (const sql of indexes) {
    try {
      await db.query(sql);
      const indexName = sql.match(/idx_\w+/)?.[0] || 'unknown';
      console.log(`  ✅ ${indexName}`);
      success++;
    } catch (err) {
      console.error(`  ❌ ${err.message}`);
    }
  }
  
  console.log(`\n${success}/${indexes.length} indexes created.`);
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });