import nodemailer from 'nodemailer';
import env from './env.js';
import logger from './logger.js';

let transporter = null;

/**
 * Initializes or retrieves the Nodemailer transport instance
 */
export function getEmailTransporter() {
  if (transporter) return transporter;

  if (env.EMAIL_HOST && env.EMAIL_USER) {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_PORT === 465,
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASSWORD,
      },
    });
  } else {
    // Development fallback mock transport
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
    logger.warn('SMTP credentials not configured. Outbound emails will be streamed to application logs.');
  }

  return transporter;
}

/**
 * Dispatches a password reset email
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.userName - Recipient full name
 * @param {string} options.resetUrl - Full password reset URL including the secure token
 */
export async function sendPasswordResetEmail({ to, userName, resetUrl }) {
  const mailer = getEmailTransporter();

  const mailOptions = {
    from: env.EMAIL_FROM,
    to,
    subject: 'DevFlow - Password Reset Request',
    text: `Hello ${userName},\n\nYou requested to reset your DevFlow password.\nPlease click the link below or copy it to your browser to set a new password:\n\n${resetUrl}\n\nThis link will expire in 1 hour. If you did not make this request, you can safely ignore this email.\n\nBest regards,\nDevFlow Team`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1e293b;">
        <h2 style="color: #4f46e5; margin-bottom: 16px;">DevFlow Password Reset</h2>
        <p>Hello <strong>${userName}</strong>,</p>
        <p>We received a request to reset your password. Click the button below to choose a new password:</p>
        <div style="margin: 28px 0;">
          <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
        </div>
        <p style="font-size: 13px; color: #64748b;">This password reset link will expire in 1 hour.<br/>If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8;">DevFlow &bull; Secure Team Task Management</p>
      </div>
    `,
  };

  const info = await mailer.sendMail(mailOptions);
  logger.info(`Password reset email dispatched to: ${to}`);
  return info;
}

export default {
  getEmailTransporter,
  sendPasswordResetEmail,
};
