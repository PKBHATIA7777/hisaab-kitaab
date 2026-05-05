/* server/scripts/migrateAllFeatures.js */
/* Run with: node server/scripts/migrateAllFeatures.js */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function migrate() {
  console.log("🚀 Starting master migration for all 5 features...\n");

  const steps = [
    // ─────────────────────────────────────────────
    // FEATURE 1: Settlement Records Table
    // ─────────────────────────────────────────────
    {
      name: "Create settlement_records table",
      sql: `
        CREATE TABLE IF NOT EXISTS settlement_records (
          id SERIAL PRIMARY KEY,
          chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
          event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
          from_member_id INTEGER NOT NULL REFERENCES chapter_members(id) ON DELETE CASCADE,
          to_member_id INTEGER NOT NULL REFERENCES chapter_members(id) ON DELETE CASCADE,
          amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
          marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          note VARCHAR(200),
          status VARCHAR(20) DEFAULT 'settled',
          marked_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    },
    {
      name: "Index: settlement_records by chapter",
      sql: `CREATE INDEX IF NOT EXISTS idx_settlement_records_chapter ON settlement_records(chapter_id);`
    },
    {
      name: "Index: settlement_records by event",
      sql: `CREATE INDEX IF NOT EXISTS idx_settlement_records_event ON settlement_records(event_id);`
    },
    {
      name: "Index: settlement_records by from_member",
      sql: `CREATE INDEX IF NOT EXISTS idx_settlement_records_from ON settlement_records(from_member_id);`
    },
    {
      name: "Index: settlement_records by to_member",
      sql: `CREATE INDEX IF NOT EXISTS idx_settlement_records_to ON settlement_records(to_member_id);`
    },

    // ─────────────────────────────────────────────
    // FEATURE 3: Personal Chapter + Cross-Chapter Sync
    // ─────────────────────────────────────────────
    {
      name: "Add is_personal to chapters",
      sql: `ALTER TABLE chapters ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE;`
    },
    {
      name: "Add source_chapter_id to expenses",
      sql: `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source_chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL;`
    },
    {
      name: "Add source_member_id to expenses",
      sql: `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source_member_id INTEGER REFERENCES chapter_members(id) ON DELETE SET NULL;`
    },
    {
      name: "Add is_synced_from_chapter to expenses",
      sql: `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_synced_from_chapter BOOLEAN DEFAULT FALSE;`
    },
    {
      name: "Add sync_consumed_snapshot to expenses",
      sql: `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS sync_consumed_snapshot DECIMAL(12,2);`
    },
    {
      name: "Add sync_dismissed to expenses (user dismissed the stale warning)",
      sql: `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS sync_dismissed BOOLEAN DEFAULT FALSE;`
    },

    // ─────────────────────────────────────────────
    // FEATURE 4: Expense Categories
    // ─────────────────────────────────────────────
    {
      name: "Create expense_categories table",
      sql: `
        CREATE TABLE IF NOT EXISTS expense_categories (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(50) NOT NULL,
          color VARCHAR(7) DEFAULT '#888888',
          icon VARCHAR(10) DEFAULT '📦',
          is_system BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT unique_category_per_user UNIQUE (user_id, name)
        );
      `
    },
    {
      name: "Index: expense_categories by user",
      sql: `CREATE INDEX IF NOT EXISTS idx_expense_categories_user ON expense_categories(user_id);`
    },
    {
      name: "Add category_id to expenses",
      sql: `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL;`
    },

    // Seed system categories (user_id = NULL means global/system)
    {
      name: "Seed system categories",
      sql: `
        INSERT INTO expense_categories (user_id, name, color, icon, is_system)
        VALUES
          (NULL, 'Food',         '#FF6B6B', '🍕', TRUE),
          (NULL, 'Travel',       '#4ECDC4', '✈️', TRUE),
          (NULL, 'Monthly Bill', '#45B7D1', '🏠', TRUE),
          (NULL, 'Outing',       '#F9CA24', '🎉', TRUE),
          (NULL, 'Health',       '#A8E6CF', '💊', TRUE),
          (NULL, 'Shopping',     '#FFB347', '🛍️', TRUE),
          (NULL, 'Other',        '#C9C9C9', '📦', TRUE)
        ON CONFLICT DO NOTHING;
      `
    },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const step of steps) {
    try {
      await db.query(step.sql);
      console.log(`  ✅ ${step.name}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ ${step.name}: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n📊 Migration complete: ${successCount} succeeded, ${failCount} failed.`);

  if (failCount > 0) {
    console.log("⚠️  Some steps failed. Review errors above — they may be safe to ignore if column/table already exists.");
  } else {
    console.log("🎉 All migrations applied successfully!");
  }

  process.exit(0);
}

migrate().catch(err => {
  console.error("Fatal migration error:", err);
  process.exit(1);
});