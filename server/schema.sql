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
  created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  is_personal BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  last_opened_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chapters_created_by ON chapters(created_by);

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
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chapter_members_user_id ON chapter_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_members_friend_id ON chapter_members(friend_id);
CREATE INDEX IF NOT EXISTS idx_chapter_members_user_chapter ON chapter_members(user_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_members_chapter_id ON chapter_members(chapter_id);

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
  source_chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  source_member_id INTEGER REFERENCES chapter_members(id) ON DELETE SET NULL,
  is_synced_from_chapter BOOLEAN DEFAULT FALSE,
  sync_consumed_snapshot DECIMAL(12, 2),
  sync_dismissed BOOLEAN DEFAULT FALSE,
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
  marked_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_settlement_records_chapter ON settlement_records(chapter_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_event ON settlement_records(event_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_from ON settlement_records(from_member_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_to ON settlement_records(to_member_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_chapter_status ON settlement_records(chapter_id, status);

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
