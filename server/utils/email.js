const sgMail = require("@sendgrid/mail");

// ── SENDGRID SETUP ────────────────────────────────────────────
// Using SendGrid HTTP API instead of SMTP because Render free tier
// blocks outbound SMTP ports (465, 587). HTTP API uses port 443
// which is always open.
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ── WARM UP (no-op for HTTP API, kept for interface compatibility) ──
async function warmUpEmailConnection() {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("⚠️  SENDGRID_API_KEY not set — emails will not be sent in production");
    return;
  }
  console.log("✅ Email service ready (SendGrid HTTP API)");
}

// ── MAIN SEND FUNCTION ────────────────────────────────────────
async function sendOtpEmail(to, subject, text) {
  // Dev mode: log to console if no API key configured
  if (!process.env.SENDGRID_API_KEY) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n${"=".repeat(50)}`);
      console.log(`[DEV EMAIL] To: ${to}`);
      console.log(`[DEV EMAIL] Subject: ${subject}`);
      console.log(`[DEV EMAIL] Body: ${text}`);
      console.log(`${"=".repeat(50)}\n`);
    } else {
      console.warn("⚠️  SENDGRID_API_KEY not set in production — OTP not sent");
    }
    return;
  }

  const fromAddress = process.env.EMAIL_USER;
  if (!fromAddress) {
    throw new Error("EMAIL_USER env var not set — cannot send email without a from address");
  }

  const msg = {
    to,
    from: {
      email: fromAddress,
      name: "Hisaab-Kitaab",
    },
    subject,
    text,
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

  try {
    await sgMail.send(msg);
    console.log(`✅ Email sent to ${to} via SendGrid`);
  } catch (err) {
    // SendGrid errors have a response body with details
    const detail = err.response?.body?.errors?.[0]?.message || err.message;
    console.error(`❌ SendGrid email failed to ${to}:`, detail);
    throw new Error(`Email delivery failed: ${detail}`);
  }
}

module.exports = { sendOtpEmail, warmUpEmailConnection };
