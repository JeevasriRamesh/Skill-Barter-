const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    return null;
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
  return transporter;
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 * @returns {Promise<void>}
 */
async function sendEmail(to, subject, html) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[emailService] EMAIL_USER / EMAIL_PASS not set — skipping email');
    return;
  }
  const from = process.env.EMAIL_USER;
  await transport.sendMail({
    from,
    to,
    subject,
    html
  });
}

module.exports = { sendEmail };
