/* server/migrations/1782309199470_add-added-by-to-expenses.js */

module.exports = {
  up: async (pgm) => {
    // 1. Add the column
    pgm.sql(`
      ALTER TABLE expenses 
      ADD COLUMN IF NOT EXISTS added_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);

    // 2. Backfill for existing expenses
    // The creator of the chapter is the one who added all legacy expenses.
    pgm.sql(`
      UPDATE expenses e
      SET added_by_user_id = c.created_by
      FROM chapters c
      WHERE e.chapter_id = c.id;
    `);
  },

  down: async (pgm) => {
    pgm.sql(`
      ALTER TABLE expenses 
      DROP COLUMN IF EXISTS added_by_user_id;
    `);
  }
};
