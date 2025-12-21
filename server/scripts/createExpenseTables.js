/* server/scripts/createExpenseTables.js */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function createTables() {
  console.log("🏗️  Creating Expense Tables...");

  const queries = [
    // 1. Create EXPENSES table
    // Stores the main transaction info: Who paid, how much, and what for.
    `CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
      payer_member_id INTEGER REFERENCES chapter_members(id) ON DELETE SET NULL, 
      amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
      description VARCHAR(100),
      expense_date TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    );`,

    // 2. Create EXPENSE_SPLITS table
    // Stores the breakdown: Which member owes how much for a specific expense.
    `CREATE TABLE IF NOT EXISTS expense_splits (
      id SERIAL PRIMARY KEY,
      expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
      member_id INTEGER REFERENCES chapter_members(id) ON DELETE CASCADE,
      amount_owed DECIMAL(12, 2) NOT NULL DEFAULT 0
    );`,

    // 3. Index: Faster lookups for "Expenses in a Chapter"
    `CREATE INDEX IF NOT EXISTS idx_expenses_chapter_id ON expenses(chapter_id);`,

    // 4. Index: Faster calculations for "How much does Member X owe?"
    `CREATE INDEX IF NOT EXISTS idx_expense_splits_member_id ON expense_splits(member_id);`
  ];

  try {
    for (const q of queries) {
      await db.query(q);
    }
    console.log("✅ Expense tables created successfully!");
  } catch (err) {
    console.error("❌ Failed to create tables:", err);
  } finally {
    process.exit();
  }
}

createTables();