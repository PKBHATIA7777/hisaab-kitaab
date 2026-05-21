/* server/scripts/addChangeDetection.js */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function migrate() {
  console.log("Adding change detection columns...");
  
  // Add updated_at to expenses (for sync watermarking)
  await db.query(`
    ALTER TABLE expenses 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);
  
  // Add chapter_updated_at trigger: updates when any expense in the chapter changes
  // This lets clients check one field to know if anything in a chapter changed
  await db.query(`
    ALTER TABLE chapters 
    ADD COLUMN IF NOT EXISTS data_updated_at TIMESTAMP DEFAULT NOW()
  `);
  
  // Create function to update chapter's data_updated_at
  await db.query(`
    CREATE OR REPLACE FUNCTION update_chapter_data_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      UPDATE chapters 
      SET data_updated_at = NOW() 
      WHERE id = COALESCE(NEW.chapter_id, OLD.chapter_id);
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;
  `);
  
  // Trigger on expense insert/update/delete
  await db.query(`
    DROP TRIGGER IF EXISTS trg_expenses_update_chapter ON expenses;
    CREATE TRIGGER trg_expenses_update_chapter
    AFTER INSERT OR UPDATE OR DELETE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_chapter_data_timestamp();
  `);
  
  // Trigger on settlement records changes
  await db.query(`
    DROP TRIGGER IF EXISTS trg_settlements_update_chapter ON settlement_records;
    CREATE TRIGGER trg_settlements_update_chapter
    AFTER INSERT OR UPDATE OR DELETE ON settlement_records
    FOR EACH ROW EXECUTE FUNCTION update_chapter_data_timestamp();
  `);
  
  // Index for polling queries ("give me all chapters updated after timestamp X")
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_chapters_data_updated
    ON chapters(created_by, data_updated_at DESC)
  `);
  
  console.log("✅ Change detection infrastructure ready.");
  console.log("Future use: GET /api/chapters/:id/changes?since=<timestamp>");
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });