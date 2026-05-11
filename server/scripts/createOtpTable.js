const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

async function migrate() {
  console.log("Creating OTPs table...");
  await db.query(`
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
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);`);
  console.log("Done.");
  process.exit();
}
migrate().catch(e => { console.error(e); process.exit(1); });