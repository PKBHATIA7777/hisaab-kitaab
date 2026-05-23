const { Resend } = require("resend");

// ── RESEND SETUP ──────────────────────────────────────────────
// Using Resend HTTP API — works on Render free tier (port 443).
// Free plan: 3,000 emails/month, 100/day, no trial expiry.
// Domain verified: parthenterprises.org.in
let _resend = null;

function getResendClient() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// ── WARM UP (no-op for HTTP API, kept for interface compatibility) ──
async function warmUpEmailConnection() {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️  RESEND_API_KEY not set — emails will not be sent in production");
    return;
  }
  console.log("✅ Email service ready (Resend HTTP API)");
}

// ── MAIN SEND FUNCTION ────────────────────────────────────────
async function sendOtpEmail(to, subject, text) {
  // Dev mode: log to console if no API key configured
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n${"=".repeat(50)}`);
      console.log(`[DEV EMAIL] To: ${to}`);
      console.log(`[DEV EMAIL] Subject: ${subject}`);
      console.log(`[DEV EMAIL] Body: ${text}`);
      console.log(`${"=".repeat(50)}\n`);
    } else {
      console.warn("⚠️  RESEND_API_KEY not set in production — OTP not sent");
    }
    return;
  }

  const resend = getResendClient();

  // Sending from verified domain parthenterprises.org.in
  // This allows sending to any recipient email address
  const fromAddress = "noreply@parthenterprises.org.in";
  const fromName = "Hisaab-Kitaab";

  try {
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to,
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
    });

    if (error) {
      console.error(`❌ Resend email failed to ${to}:`, error.message || JSON.stringify(error));
      throw new Error(`Email delivery failed: ${error.message || JSON.stringify(error)}`);
    }

    console.log(`✅ Email sent to ${to} via Resend (id: ${data?.id})`);
  } catch (err) {
    if (err.message.startsWith("Email delivery failed:")) throw err;
    console.error(`❌ Resend unexpected error to ${to}:`, err.message);
    throw new Error(`Email delivery failed: ${err.message}`);
  }
}

module.exports = { sendOtpEmail, warmUpEmailConnection };
