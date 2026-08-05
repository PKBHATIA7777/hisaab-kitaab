/* eslint-disable no-camelcase */

/**
 * Migration: Invitations, Notifications & Settlement Confirmations (Step 3)
 *
 * Creates two brand-new tables:
 *   1. chapter_invitations — Tracks invite lifecycle (send → accept/decline/expire/revoke)
 *   2. notifications — In-app notification center for all collaborative events
 *
 * Adds three columns to settlement_records:
 *   3. confirmation_status — Two-party settlement confirmation workflow
 *   4. confirmed_by — Which user confirmed the settlement
 *   5. confirmed_at — When it was confirmed
 *
 * This is a NON-DESTRUCTIVE migration.
 * New tables use CREATE TABLE IF NOT EXISTS.
 * Existing table columns use ADD COLUMN IF NOT EXISTS.
 * All existing settlement_records are backfilled to 'auto_confirmed'.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // ═══════════════════════════════════════════════════════════════════
  // TABLE 1: chapter_invitations
  // Tracks the full lifecycle of an invite: pending → accepted/declined/expired/revoked
  // ═══════════════════════════════════════════════════════════════════
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS chapter_invitations (
      id SERIAL PRIMARY KEY,
      chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invited_email VARCHAR(255) NOT NULL,
      invite_token VARCHAR(128) NOT NULL UNIQUE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      responded_at TIMESTAMP,
      CONSTRAINT unique_chapter_email_invite UNIQUE (chapter_id, invited_email)
    );
  `);

  // Indexes for chapter_invitations
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_invitations_token
      ON chapter_invitations(invite_token);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_invitations_email
      ON chapter_invitations(invited_email);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_invitations_chapter
      ON chapter_invitations(chapter_id);
  `);

  // Partial index: only pending invitations (most common lookup)
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_invitations_pending
      ON chapter_invitations(invited_email)
      WHERE status = 'pending';
  `);

  // ═══════════════════════════════════════════════════════════════════
  // TABLE 2: notifications
  // In-app notification center. Emails are NOT sent for these —
  // only chapter invite emails are sent (per user decision).
  // ═══════════════════════════════════════════════════════════════════
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(200) NOT NULL,
      body TEXT,
      chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
      action_url VARCHAR(500),
      metadata JSONB DEFAULT '{}',
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Primary query pattern: "show me my unread notifications, newest first"
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user
      ON notifications(user_id, is_read, created_at DESC);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_notifications_chapter
      ON notifications(chapter_id);
  `);

  // Partial index: only unread notifications (for badge count query)
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
      ON notifications(user_id)
      WHERE is_read = FALSE;
  `);

  // ═══════════════════════════════════════════════════════════════════
  // COLUMNS ON settlement_records: Two-party confirmation workflow
  //
  // confirmation_status values:
  //   'auto_confirmed' — Legacy/solo chapters: no confirmation needed
  //   'pending_confirmation' — One party marked it, waiting for other party
  //   'confirmed' — Both parties agreed
  //   'disputed' — Other party disputed the settlement
  // ═══════════════════════════════════════════════════════════════════
  pgm.sql(`
    ALTER TABLE settlement_records
      ADD COLUMN IF NOT EXISTS confirmation_status VARCHAR(20) DEFAULT 'auto_confirmed';
  `);

  pgm.sql(`
    ALTER TABLE settlement_records
      ADD COLUMN IF NOT EXISTS confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);

  pgm.sql(`
    ALTER TABLE settlement_records
      ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;
  `);

  // Backfill: All existing settlement records are auto-confirmed
  // (they were all created in solo chapters by the creator)
  pgm.sql(`
    UPDATE settlement_records
    SET confirmation_status = 'auto_confirmed'
    WHERE confirmation_status IS NULL;
  `);

  // Index for filtering settlements by confirmation status
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_settlements_confirmation
      ON settlement_records(chapter_id, confirmation_status);
  `);
};

exports.down = (pgm) => {
  // ─── Drop settlement_records columns ────────────────────────────────
  pgm.sql(`DROP INDEX IF EXISTS idx_settlements_confirmation;`);
  pgm.sql(`ALTER TABLE settlement_records DROP COLUMN IF EXISTS confirmed_at;`);
  pgm.sql(`ALTER TABLE settlement_records DROP COLUMN IF EXISTS confirmed_by;`);
  pgm.sql(`ALTER TABLE settlement_records DROP COLUMN IF EXISTS confirmation_status;`);

  // ─── Drop notifications table ───────────────────────────────────────
  pgm.sql(`DROP INDEX IF EXISTS idx_notifications_user_unread;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_notifications_chapter;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_notifications_user;`);
  pgm.sql(`DROP TABLE IF EXISTS notifications;`);

  // ─── Drop chapter_invitations table ─────────────────────────────────
  pgm.sql(`DROP INDEX IF EXISTS idx_invitations_pending;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_invitations_chapter;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_invitations_email;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_invitations_token;`);
  pgm.sql(`DROP TABLE IF EXISTS chapter_invitations;`);
};
