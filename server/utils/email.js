const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error("EMAIL_USER or EMAIL_PASS not set in .env");
  }

  // UPDATED CONFIGURATION:
  // Using port 465 with secure: true fixes the ETIMEDOUT error on Render.
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, 
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

async function sendOtpEmail(to, subject, text) {
  const t = getTransporter();

  console.log(`Sending email to ${to}...`); // Log start

  try {
    await t.sendMail({
      from: `"Hisaab-Kitaab" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });
    console.log(`Email sent successfully to ${to}`); // Log success
  } catch (err) {
    console.error("Nodemailer Error:", err); // Log exact error
    throw err;
  }
}

module.exports = { sendOtpEmail };