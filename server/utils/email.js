



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
  // 3. If no key, just log it (Local Dev Mode)
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`\n[DEV-MODE] Email to: ${to} | Subject: ${subject}`);
    console.log(`[DEV-MODE] Body: ${text}\n`);
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


// const sgMail = require("@sendgrid/mail");

// const apiKey = process.env.SENDGRID_API_KEY;
// if (!apiKey) {
//   throw new Error("SENDGRID_API_KEY not set in env");
// }
// sgMail.setApiKey(apiKey);

// async function sendOtpEmail(to, subject, text) {
//   const msg = {
//     to,
//     from: process.env.EMAIL_FROM, // must be a verified sender
//     subject,
//     text,
//   };

//   try {
//     await sgMail.send(msg);
//     console.log(`Email sent successfully to ${to}`);
//   } catch (err) {
//     console.error("SendGrid Error:", err);
//     throw err;
//   }
// }

// module.exports = { sendOtpEmail };
