const { Resend } = require("resend");
const log = require("./logger");

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
    log.warn("RESEND_API_KEY not set — emails will not be sent in production");
    return;
  }
  log.info("Email service ready (Resend HTTP API)");
}

// ── MAIN SEND FUNCTION ────────────────────────────────────────
async function sendOtpEmail(to, subject, text) {
  // Dev mode: log to console if no API key configured
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== "production") {
      log.info({ to, subject, text }, "Development email logger");
    } else {
      log.warn("RESEND_API_KEY not set in production — OTP not sent");
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
      log.error({ error, to }, "Resend email failed");
      throw new Error(`Email delivery failed: ${error.message || JSON.stringify(error)}`);
    }

    log.info({ to, emailId: data?.id }, "Email sent successfully");
  } catch (err) {
    if (err.message.startsWith("Email delivery failed:")) throw err;
    log.error({ err, to }, "Resend unexpected error");
    throw new Error(`Email delivery failed: ${err.message}`);
  }
}

// ── INVITATION EMAIL ──────────────────────────────────────────
async function sendInviteEmail(to, chapterName, inviterName, inviteLink) {
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== "production") {
      log.info({ to, chapterName, inviteLink }, "Development Invite Logger");
    }
    return;
  }

  const resend = getResendClient();
  const fromAddress = "noreply@parthenterprises.org.in";
  const fromName = "Hisaab-Kitaab";
  const subject = `${inviterName} invited you to join "${chapterName}"`;

  try {
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to,
      subject,
      text: `You have been invited to join the chapter ${chapterName} by ${inviterName}. Click here to accept: ${inviteLink}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #d000ff; margin-bottom: 16px;">Hisaab-Kitaab</h2>
          <p style="color: #333; font-size: 16px;">Hi there,</p>
          <p style="color: #333; font-size: 16px;">
            <strong>${inviterName}</strong> has invited you to collaborate on the chapter <strong>"${chapterName}"</strong>.
          </p>
          <div style="margin: 32px 0; text-align: center;">
            <a href="${inviteLink}" style="background-color: #d000ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
              View Invitation
            </a>
          </div>
          <p style="color: #888; font-size: 12px;">
            This invitation will expire in 15 days. If you don't have an account, you'll be able to create one before joining.
          </p>
        </div>
      `,
    });

    if (error) throw new Error(error.message || JSON.stringify(error));
    log.info({ to, emailId: data?.id }, "Invite email sent successfully");
  } catch (err) {
    log.error({ err, to }, "Invite email failed");
    throw new Error(`Invite delivery failed: ${err.message}`);
  }
}

module.exports = { sendOtpEmail, sendInviteEmail, warmUpEmailConnection };
