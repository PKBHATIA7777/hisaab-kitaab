const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST / SMTP_USER / SMTP_PASS not set in env");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: { user, pass },
  });

  return transporter;
}

async function sendOtpEmail(to, subject, text) {
  const t = getTransporter();

  console.log(`Sending email to ${to}...`);

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || "no-reply@example.com",
      to,
      subject,
      text,
    });
    console.log(`Email sent successfully to ${to}`);
  } catch (err) {
    console.error("Nodemailer Error:", err);
    throw err;
  }
}

module.exports = { sendOtpEmail };
