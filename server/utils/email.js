const nodemailer = require("nodemailer");

// ── PERSISTENT TRANSPORT (created once, reused forever) ──────
// Creating a new transport per request causes a new TCP+TLS handshake
// every time, which takes 2-10 seconds and frequently times out on
// cloud providers that throttle outbound SMTP connections.
let _transporter = null;
let _transporterCreatedAt = 0;
const TRANSPORT_TTL = 10 * 60 * 1000; // Recreate every 10 minutes (handles stale connections)

function getTransporter() {
  const now = Date.now();

  // Return cached transporter if still fresh
  if (_transporter && (now - _transporterCreatedAt) < TRANSPORT_TTL) {
    return _transporter;
  }

  // Recreate if missing or stale
  _transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    // PORT STRATEGY: Use 465 (SSL) instead of 587 (STARTTLS)
    // Render free tier frequently blocks port 587 outbound.
    // Port 465 with direct SSL is faster (no STARTTLS negotiation) 
    // and more reliably open on cloud providers.
    port: 465,
    secure: true, // true for port 465, false for 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // ── CRITICAL TIMEOUTS ────────────────────────────────────
    connectionTimeout: 10000,  // 10s to establish TCP connection
    greetingTimeout: 8000,     // 8s to receive SMTP greeting
    socketTimeout: 15000,      // 15s for any socket inactivity
    // ── CONNECTION POOL ──────────────────────────────────────
    pool: true,           // Reuse connections instead of creating new ones
    maxConnections: 3,    // Max simultaneous connections to Gmail
    maxMessages: 50,      // Recycle connection after 50 messages (prevents stale state)
    rateDelta: 1000,      // Minimum ms between messages (avoid Gmail rate limits)
    rateLimit: 3,         // Max 3 messages per rateDelta window
  });

  _transporterCreatedAt = now;
  return _transporter;
}

// ── VERIFY CONNECTION ON STARTUP (non-blocking) ──────────────
// This warms up the SMTP connection when the server starts,
// so the first OTP request doesn't pay the connection cost.
async function warmUpEmailConnection() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log("✅ Email service connected and ready");
  } catch (err) {
    // Non-fatal: server still starts, just log the warning
    console.warn("⚠️ Email service warm-up failed (will retry on first send):", err.message);
    // Reset so next call tries fresh
    _transporter = null;
    _transporterCreatedAt = 0;
  }
}

// ── MAIN SEND FUNCTION WITH RETRY ────────────────────────────
async function sendOtpEmail(to, subject, text) {
  // Dev mode: log to console if no credentials
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n${"=".repeat(50)}`);
      console.log(`[DEV EMAIL] To: ${to}`);
      console.log(`[DEV EMAIL] Subject: ${subject}`);
      console.log(`[DEV EMAIL] Body: ${text}`);
      console.log(`${"=".repeat(50)}\n`);
    } else {
      console.warn("⚠️ EMAIL_USER/EMAIL_PASS not set in production — OTP not sent");
    }
    return;
  }

  const mailOptions = {
    from: `"Hisaab-Kitaab" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    // HTML version for better deliverability and UX
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #d000ff; margin-bottom: 8px;">Hisaab-Kitaab</h2>
        <p style="color: #333; font-size: 16px;">${text}</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">
          This code expires in 10 minutes. Do not share it with anyone.
        </p>
      </div>
    `,
  };

  // ── RETRY LOGIC ───────────────────────────────────────────
  // Attempt 1: Use cached transporter
  // Attempt 2: Force-recreate transporter and retry (handles stale connections)
  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const transporter = getTransporter();
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${to} (attempt ${attempt}):`, info.messageId);
      return; // Success — exit
    } catch (err) {
      console.error(`❌ Email send failed (attempt ${attempt}/${MAX_ATTEMPTS}):`, err.message);

      if (attempt < MAX_ATTEMPTS) {
        // Force transporter recreation for retry
        _transporter = null;
        _transporterCreatedAt = 0;
        // Brief pause before retry
        await new Promise(r => setTimeout(r, 1000));
      } else {
        // All attempts failed — throw so controller can handle gracefully
        throw new Error(`Email delivery failed after ${MAX_ATTEMPTS} attempts: ${err.message}`);
      }
    }
  }
}

module.exports = { sendOtpEmail, warmUpEmailConnection };