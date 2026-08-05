-- Hisaab-Kitaab Database Schema Documentation
-- Generated: June 2026

-- 1. users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  real_name VARCHAR(100),
  username VARCHAR(50) UNIQUE,
  provider VARCHAR(20) DEFAULT 'local',
  google_id VARCHAR(255),
  needs_password BOOLEAN DEFAULT FALSE,
  jwt_generation INTEGER DEFAULT 0,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. chapters table
CREATE TABLE IF NOT EXISTS chapters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(200) DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  is_personal BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_collaborative BOOLEAN DEFAULT FALSE,
  data_updated_at TIMESTAMP DEFAULT NOW(),
  last_opened_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chapters_created_by ON chapters(created_by);
CREATE INDEX IF NOT EXISTS idx_chapters_collaborative ON chapters(is_collaborative) WHERE is_collaborative = TRUE;
CREATE INDEX IF NOT EXISTS idx_chapters_data_updated ON chapters(created_by, data_updated_at DESC);

-- 3. friends table
CREATE TABLE IF NOT EXISTS friends (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  friend_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  mobile VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_user_friend_username UNIQUE (user_id, username)
);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);

-- 4. chapter_members table
CREATE TABLE IF NOT EXISTS chapter_members (
  id SERIAL PRIMARY KEY,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
  member_name VARCHAR(100) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  friend_id INTEGER REFERENCES friends(id) ON DELETE SET NULL,
  role VARCHAR(20) DEFAULT 'member',           -- 'admin' | 'member'
  status VARCHAR(20) DEFAULT 'active',         -- 'active' | 'invited' | 'left' | 'removed'
  invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  invited_email VARCHAR(255),
  joined_at TIMESTAMP,
  left_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chapter_members_user_id ON chapter_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_members_friend_id ON chapter_members(friend_id);
CREATE INDEX IF NOT EXISTS idx_chapter_members_user_chapter ON chapter_members(user_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_members_chapter_id ON chapter_members(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_members_status ON chapter_members(chapter_id, status);
CREATE INDEX IF NOT EXISTS idx_chapter_members_role ON chapter_members(chapter_id, role);
CREATE INDEX IF NOT EXISTS idx_chapter_members_email ON chapter_members(invited_email) WHERE invited_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chapter_members_active ON chapter_members(chapter_id) WHERE status = 'active';

-- 5. events table
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_chapter_id ON events(chapter_id);
CREATE INDEX IF NOT EXISTS idx_events_chapter_status ON events(chapter_id, status);

-- 6. expense_categories table
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
CREATE INDEX IF NOT EXISTS idx_expense_categories_user ON expense_categories(user_id);

-- 7. expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  payer_member_id INTEGER REFERENCES chapter_members(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  description VARCHAR(100),
  expense_date TIMESTAMP DEFAULT NOW(),
  category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
  added_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source_chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  source_member_id INTEGER REFERENCES chapter_members(id) ON DELETE SET NULL,
  is_synced_from_chapter BOOLEAN DEFAULT FALSE,
  sync_consumed_snapshot DECIMAL(12, 2),
  sync_dismissed BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_chapter_id ON expenses(chapter_id);
CREATE INDEX IF NOT EXISTS idx_expenses_event_id ON expenses(event_id);
CREATE INDEX IF NOT EXISTS idx_expenses_chapter_date ON expenses(chapter_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_chapter_created ON expenses(chapter_id, created_at DESC);

-- 8. expense_splits table
CREATE TABLE IF NOT EXISTS expense_splits (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES chapter_members(id) ON DELETE CASCADE,
  amount_owed DECIMAL(12, 2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_expense_splits_member_id ON expense_splits(member_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);

-- 9. otps table
CREATE TABLE IF NOT EXISTS otps (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_email_purpose UNIQUE (email, purpose)
);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);

-- 10. settlement_records table
CREATE TABLE IF NOT EXISTS settlement_records (
  id SERIAL PRIMARY KEY,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  from_member_id INTEGER NOT NULL REFERENCES chapter_members(id) ON DELETE CASCADE,
  to_member_id INTEGER NOT NULL REFERENCES chapter_members(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note VARCHAR(200),
  status VARCHAR(20) DEFAULT 'settled',
  confirmation_status VARCHAR(20) DEFAULT 'auto_confirmed',
  confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMP,
  marked_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_settlement_records_chapter ON settlement_records(chapter_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_event ON settlement_records(event_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_from ON settlement_records(from_member_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_to ON settlement_records(to_member_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_chapter_status ON settlement_records(chapter_id, status);
CREATE INDEX IF NOT EXISTS idx_settlements_confirmation ON settlement_records(chapter_id, confirmation_status);

-- 10a. chapter_invitations table
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
CREATE INDEX IF NOT EXISTS idx_invitations_token ON chapter_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON chapter_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_invitations_chapter ON chapter_invitations(chapter_id);
CREATE INDEX IF NOT EXISTS idx_invitations_pending ON chapter_invitations(invited_email) WHERE status = 'pending';

-- 10b. notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
  related_entity_id INTEGER,
  action_url VARCHAR(500),
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_chapter ON notifications(chapter_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE is_read = FALSE;

-- 11. device_sessions table
CREATE TABLE IF NOT EXISTS device_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(64) NOT NULL UNIQUE,
  device_name VARCHAR(255),
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  ip_address VARCHAR(50),
  last_active_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  is_current BOOLEAN DEFAULT FALSE,
  jwt_iat INTEGER
);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user ON device_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_session_id ON device_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user_active ON device_sessions(user_id, last_active_at DESC);

-- 12. refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  device_hint VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP DEFAULT NOW(),
  revoked BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- 13. Trigger: Auto-bump chapter data_updated_at on child table changes
-- Used by the heartbeat polling endpoint for real-time sync detection.
CREATE OR REPLACE FUNCTION update_chapter_data_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chapters
  SET data_updated_at = NOW()
  WHERE id = COALESCE(NEW.chapter_id, OLD.chapter_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expenses_update_chapter ON expenses;
CREATE TRIGGER trg_expenses_update_chapter
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_chapter_data_timestamp();

DROP TRIGGER IF EXISTS trg_settlements_update_chapter ON settlement_records;
CREATE TRIGGER trg_settlements_update_chapter
AFTER INSERT OR UPDATE OR DELETE ON settlement_records
FOR EACH ROW EXECUTE FUNCTION update_chapter_data_timestamp();
