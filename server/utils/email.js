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
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

async function sendOtpEmail(to, subject, text) {
  const t = getTransporter();

  await t.sendMail({
    from: `"Hisaab-Kitaab" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  });
}

module.exports = { sendOtpEmail };
