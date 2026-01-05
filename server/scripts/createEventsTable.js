/* server/scripts/createEventsTable.js */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function createEventsTable() {
  console.log("🏗️  Creating Events Table & Updating Expenses...");

  const queries = [
    // 1. Create EVENTS table
    // Represents a sub-chapter or specific event (e.g. "Goa Trip") inside a Chapter.
    // We treat it as a "Tag" container.
    `CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      status VARCHAR(20) DEFAULT 'active', -- 'active' or 'archived'
      created_at TIMESTAMP DEFAULT NOW()
    );`,

    // 2. Add event_id to EXPENSES table
    // Links an expense to a specific event. Nullable (if null, it's a general chapter expense).
    `ALTER TABLE expenses 
     ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id) ON DELETE SET NULL;`,

    // 3. Index: Faster lookups for "Events in a Chapter"
    `CREATE INDEX IF NOT EXISTS idx_events_chapter_id ON events(chapter_id);`,

    // 4. Index: Faster lookups for "Expenses in an Event"
    `CREATE INDEX IF NOT EXISTS idx_expenses_event_id ON expenses(event_id);`
  ];

  try {
    for (const q of queries) {
      await db.query(q);
    }
    console.log("✅ Events table created and Expenses updated successfully!");
  } catch (err) {
    console.error("❌ Failed to migrate DB:", err);
  } finally {
    process.exit();
  }
}

createEventsTable();