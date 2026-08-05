/* eslint-disable no-camelcase */

/**
 * Migration: Collaborative Chapters Foundation (Step 1)
 *
 * Adds the `is_collaborative` flag to the chapters table and normalizes
 * columns (`description`, `data_updated_at`, `expenses.updated_at`) that
 * were added via ad-hoc scripts in production but never formalized in the
 * migration chain.
 *
 * This is a NON-DESTRUCTIVE migration — all columns use IF NOT EXISTS
 * and all existing data is preserved.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // ─── 1. Chapters: Add is_collaborative flag ──────────────────────────
  // Default FALSE so every existing chapter remains a solo chapter.
  // Only new chapters created with is_collaborative=TRUE will be collaborative.
  pgm.sql(`
    ALTER TABLE chapters
      ADD COLUMN IF NOT EXISTS is_collaborative BOOLEAN DEFAULT FALSE;
  `);

  // ─── 2. Chapters: Normalize description column ──────────────────────
  // This column exists in production (varchar 50) but was never in a migration.
  // Using IF NOT EXISTS so it's safe on both fresh and existing DBs.
  pgm.sql(`
    ALTER TABLE chapters
      ADD COLUMN IF NOT EXISTS description VARCHAR(200) DEFAULT '';
  `);

  // ─── 3. Chapters: Normalize data_updated_at column ──────────────────
  // Added by scripts/addChangeDetection.js in production.
  // Formalizing it here so all environments have it.
  pgm.sql(`
    ALTER TABLE chapters
      ADD COLUMN IF NOT EXISTS data_updated_at TIMESTAMP DEFAULT NOW();
  `);

  // ─── 4. Expenses: Normalize updated_at column ───────────────────────
  // Also added by addChangeDetection.js.
  pgm.sql(`
    ALTER TABLE expenses
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  // ─── 5. Trigger: Auto-bump chapter data_updated_at on changes ───────
  // This trigger fires when expenses or settlements change, so that
  // clients polling the heartbeat endpoint detect updates.
  // Using CREATE OR REPLACE so it's idempotent.
  pgm.sql(`
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

  // Expense changes trigger
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_expenses_update_chapter ON expenses;
    CREATE TRIGGER trg_expenses_update_chapter
    AFTER INSERT OR UPDATE OR DELETE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_chapter_data_timestamp();
  `);

  // Settlement changes trigger
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_settlements_update_chapter ON settlement_records;
    CREATE TRIGGER trg_settlements_update_chapter
    AFTER INSERT OR UPDATE OR DELETE ON settlement_records
    FOR EACH ROW EXECUTE FUNCTION update_chapter_data_timestamp();
  `);

  // ─── 6. Index: Fast lookup by collaborative status ──────────────────
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_chapters_collaborative
      ON chapters(is_collaborative)
      WHERE is_collaborative = TRUE;
  `);

  // ─── 7. Index: Chapter data_updated_at for heartbeat polling ────────
  // May already exist from the ad-hoc script — safe with IF NOT EXISTS.
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_chapters_data_updated
      ON chapters(created_by, data_updated_at DESC);
  `);

  // ─── 8. Backfill: All existing chapters are explicitly non-collaborative
  pgm.sql(`
    UPDATE chapters SET is_collaborative = FALSE WHERE is_collaborative IS NULL;
  `);
};

exports.down = (pgm) => {
  // Reverse in order: indexes → triggers → columns
  pgm.sql(`DROP INDEX IF EXISTS idx_chapters_collaborative;`);
  // Don't drop idx_chapters_data_updated — it may have been created by the ad-hoc script
  // and dropping it could break the heartbeat endpoint in a rollback scenario.

  pgm.sql(`DROP TRIGGER IF EXISTS trg_expenses_update_chapter ON expenses;`);
  pgm.sql(`DROP TRIGGER IF EXISTS trg_settlements_update_chapter ON settlement_records;`);
  pgm.sql(`DROP FUNCTION IF EXISTS update_chapter_data_timestamp();`);

  pgm.sql(`ALTER TABLE chapters DROP COLUMN IF EXISTS is_collaborative;`);
  // Don't drop description, data_updated_at, expenses.updated_at
  // because they existed before this migration (ad-hoc scripts).
  // Dropping them would cause data loss.
};
