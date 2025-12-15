const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error("EMAIL_USER or EMAIL_PASS not set in .env");
  }

  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user,
      pass,
    },
    // ✅ FORCE IPv4: This fixes the timeout on Render
    family: 4, 
  });

  return transporter;
}

async function sendOtpEmail(to, subject, text) {
  const t = getTransporter();

  console.log(`Sending email to ${to}...`);

  try {
    await t.sendMail({
      from: `"Hisaab-Kitaab" <${process.env.EMAIL_USER}>`,
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