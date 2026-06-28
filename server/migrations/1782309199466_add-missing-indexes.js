/* eslint-disable no-camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_chapters_created_by ON chapters(created_by);
    CREATE INDEX IF NOT EXISTS idx_chapter_members_chapter_id ON chapter_members(chapter_id);
    CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_expense_splits_expense_id;
    DROP INDEX IF EXISTS idx_chapter_members_chapter_id;
    DROP INDEX IF EXISTS idx_chapters_created_by;
  `);
};
