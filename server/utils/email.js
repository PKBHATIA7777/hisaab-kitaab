const sgMail = require("@sendgrid/mail");

const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) {
  throw new Error("SENDGRID_API_KEY not set in env");
}
sgMail.setApiKey(apiKey);

async function sendOtpEmail(to, subject, text) {
  const msg = {
    to,
    from: process.env.EMAIL_FROM, // must be a verified sender
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
