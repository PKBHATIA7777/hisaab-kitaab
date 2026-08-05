module.exports = {
  up: async (pgm) => {
    pgm.sql(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE is_read = FALSE;
      CREATE INDEX IF NOT EXISTS idx_invitations_pending ON chapter_invitations(invited_email) WHERE status = 'pending';
      CREATE INDEX IF NOT EXISTS idx_chapter_members_active ON chapter_members(chapter_id) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS idx_chapters_collaborative ON chapters(is_collaborative) WHERE is_collaborative = TRUE;
      CREATE INDEX IF NOT EXISTS idx_settlements_confirmation ON settlement_records(chapter_id, confirmation_status);
    `);
  },
  down: async (pgm) => {
    pgm.sql(`
      DROP INDEX IF EXISTS idx_notifications_user_unread;
      DROP INDEX IF EXISTS idx_invitations_pending;
      DROP INDEX IF EXISTS idx_chapter_members_active;
      DROP INDEX IF EXISTS idx_chapters_collaborative;
      DROP INDEX IF EXISTS idx_settlements_confirmation;
    `);
  }
};
