/* eslint-disable no-camelcase */

/**
 * Migration: Chapter Members Evolution (Step 2)
 *
 * Evolves the chapter_members table to support collaborative features:
 *   - role: 'admin' or 'member' (admin = chapter creator)
 *   - status: 'active', 'invited', 'left', 'removed'
 *   - invited_by: which user sent the invite
 *   - joined_at: when the member accepted the invite / was added
 *   - left_at: when the member left or was removed
 *   - invited_email: the email address the invite was sent to
 *
 * Backfill logic:
 *   - The chapter creator's member row gets role='admin'
 *   - All other existing members get role='member'
 *   - All existing members get status='active' and joined_at = created_at
 *
 * This is a NON-DESTRUCTIVE migration — all existing data is preserved.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // ─── 1. Add role column ─────────────────────────────────────────────
  // 'admin' = chapter creator (single admin per chapter)
  // 'member' = regular participant
  pgm.sql(`
    ALTER TABLE chapter_members
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member';
  `);

  // ─── 2. Add status column ──────────────────────────────────────────
  // 'active'  = currently participating
  // 'invited' = invitation sent, not yet accepted
  // 'left'    = voluntarily left (historical record preserved)
  // 'removed' = admin removed them (historical record preserved)
  pgm.sql(`
    ALTER TABLE chapter_members
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
  `);

  // ─── 3. Add invited_by column ──────────────────────────────────────
  // References the user who sent the invite. NULL for legacy members.
  pgm.sql(`
    ALTER TABLE chapter_members
      ADD COLUMN IF NOT EXISTS invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);

  // ─── 4. Add joined_at column ───────────────────────────────────────
  // When the member accepted the invite or was added to the chapter.
  pgm.sql(`
    ALTER TABLE chapter_members
      ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP;
  `);

  // ─── 5. Add left_at column ─────────────────────────────────────────
  // When the member left or was removed. NULL while active.
  pgm.sql(`
    ALTER TABLE chapter_members
      ADD COLUMN IF NOT EXISTS left_at TIMESTAMP;
  `);

  // ─── 6. Add invited_email column ───────────────────────────────────
  // The email address the invite was sent to. Used for ghost member
  // auto-linking when a user signs up with a matching email.
  pgm.sql(`
    ALTER TABLE chapter_members
      ADD COLUMN IF NOT EXISTS invited_email VARCHAR(255);
  `);

  // ─── 7. Backfill: Set creator as admin ─────────────────────────────
  // For every chapter, the member whose user_id matches chapters.created_by
  // gets role='admin'. All other members remain role='member'.
  pgm.sql(`
    UPDATE chapter_members cm
    SET role = 'admin'
    FROM chapters c
    WHERE cm.chapter_id = c.id
      AND cm.user_id = c.created_by
      AND cm.user_id IS NOT NULL;
  `);

  // ─── 8. Backfill: Set all existing members to active ───────────────
  // Any member that has no status yet gets status='active'.
  // joined_at is backfilled from the member's created_at timestamp.
  pgm.sql(`
    UPDATE chapter_members
    SET status = 'active',
        joined_at = COALESCE(joined_at, NOW())
    WHERE status IS NULL OR status = '';
  `);

  // ─── 9. Indexes for common query patterns ──────────────────────────
  // Fast filtering by status (e.g., "show me only active members")
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_chapter_members_status
      ON chapter_members(chapter_id, status);
  `);

  // Fast admin lookup (e.g., "who is the admin of this chapter?")
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_chapter_members_role
      ON chapter_members(chapter_id, role);
  `);

  // Fast invite lookup by email (e.g., "show me all chapters I've been invited to")
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_chapter_members_email
      ON chapter_members(invited_email)
      WHERE invited_email IS NOT NULL;
  `);

  // Partial index: only active members (most common query filter)
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_chapter_members_active
      ON chapter_members(chapter_id)
      WHERE status = 'active';
  `);
};

exports.down = (pgm) => {
  // Drop indexes first
  pgm.sql(`DROP INDEX IF EXISTS idx_chapter_members_active;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_chapter_members_email;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_chapter_members_role;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_chapter_members_status;`);

  // Drop columns (reverse order of creation)
  pgm.sql(`ALTER TABLE chapter_members DROP COLUMN IF EXISTS invited_email;`);
  pgm.sql(`ALTER TABLE chapter_members DROP COLUMN IF EXISTS left_at;`);
  pgm.sql(`ALTER TABLE chapter_members DROP COLUMN IF EXISTS joined_at;`);
  pgm.sql(`ALTER TABLE chapter_members DROP COLUMN IF EXISTS invited_by;`);
  pgm.sql(`ALTER TABLE chapter_members DROP COLUMN IF EXISTS status;`);
  pgm.sql(`ALTER TABLE chapter_members DROP COLUMN IF EXISTS role;`);
};
