const sgMail = require("@sendgrid/mail");

// 1. Only crash if we are in PRODUCTION and missing the key
if (process.env.NODE_ENV === 'production' && !process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY not set in env");
}

// 2. Only configure SendGrid if the key actually exists
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

async function sendOtpEmail(to, subject, text) {
  // 3. If no key, Log ONLY if we are NOT in production
  if (!process.env.SENDGRID_API_KEY) {
    if (process.env.NODE_ENV !== 'production') {
       console.log(`\n[DEV-MODE] Email to: ${to} | Subject: ${subject}`);
       console.log(`[DEV-MODE] Body: ${text}\n`);
    } else {
       console.warn("⚠️ Email service not configured in Production. OTP was generated but not sent.");
    }
    return;
  }

  // 4. Otherwise, send real email
  const msg = {
    to,
    from: process.env.EMAIL_FROM, 
    subject,
    text,
  };

  try {
    await sgMail.send(msg);
    console.log(`Email sent successfully to ${to}`);
  } catch (err) {
    console.error("SendGrid Error:", err);
    throw err;
  }
}

module.exports = { sendOtpEmail };
