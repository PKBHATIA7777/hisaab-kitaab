/* server/scripts/addDeviceSessions.js */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function migrate() {
  console.log("Creating device_sessions table...");
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS device_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id VARCHAR(64) NOT NULL UNIQUE,
      device_name VARCHAR(255),
      device_type VARCHAR(50),  -- 'mobile', 'tablet', 'desktop'
      browser VARCHAR(100),
      os VARCHAR(100),
      ip_address VARCHAR(50),
      last_active_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      is_current BOOLEAN DEFAULT FALSE,
      jwt_iat INTEGER  -- matches the iat in the JWT for this session
    );
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_device_sessions_user 
    ON device_sessions(user_id);
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_device_sessions_session_id 
    ON device_sessions(session_id);
  `);
  
  console.log("✅ device_sessions table created.");
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });