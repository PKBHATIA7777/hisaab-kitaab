/* server/scripts/createFriendsTable.js */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function createFriendsTable() {
  console.log("🏗️  Creating Friends Table...");

  const queries = [
    // 1. Create Friends Table
    // Stores a user's personal contacts/friends.
    `CREATE TABLE IF NOT EXISTS friends (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      username VARCHAR(50) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(20), -- Optional Landline/Other
      mobile VARCHAR(20), -- Optional Mobile
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      
      -- Constraint: A user cannot have two friends with the same username.
      -- (This ensures "user name unique for every user" as requested)
      CONSTRAINT unique_user_friend_username UNIQUE (user_id, username)
    );`,

    // 2. Index: Faster lookups for "My Friends"
    `CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);`
  ];

  try {
    for (const q of queries) {
      await db.query(q);
    }
    console.log("✅ Friends table created successfully!");
  } catch (err) {
    console.error("❌ Failed to create friends table:", err);
  } finally {
    process.exit();
  }
}

createFriendsTable();