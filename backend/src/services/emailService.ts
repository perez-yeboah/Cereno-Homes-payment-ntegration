import nodemailer from 'nodemailer';

// Configure the transporter
// For development, we'll use an Ethereal email account or log to console if not provided
// In production, these should be real SMTP credentials in your .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const info = await transporter.sendMail({
      from: '"Cereno Homes" <no-reply@cerenohomes.com>',
      to,
      subject,
      html,
    });
    console.log('Message sent: %s', info.messageId);
    if (process.env.SMTP_HOST === 'smtp.ethereal.email') {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

export const sendPaymentReceipt = async (to: string, amount: number, currency: string, planId: string) => {
  const subject = `Payment Receipt - Cereno Homes`;
  const html = `
    <h2>Payment Successful</h2>
    <p>Thank you for your payment of <strong>${currency} ${amount.toFixed(2)}</strong>.</p>
    <p>This payment has been applied to your plan: ${planId}.</p>
    <p>Best regards,<br/>The Cereno Homes Team</p>
  `;
  await sendEmail(to, subject, html);
};

export const sendProjectUpdate = async (to: string, title: string, content: string) => {
  const subject = `Project Update: ${title}`;
  const html = `
    <h2>${title}</h2>
    <div>${content}</div>
    <p>Best regards,<br/>The Cereno Homes Team</p>
  `;
  await sendEmail(to, subject, html);
};

export const sendApplicationStatusUpdate = async (to: string, status: string, propertyAddress: string) => {
  const subject = `Application Status Update - Cereno Homes`;
  const html = `
    <h2>Your application status has been updated</h2>
    <p>Your interest application for <strong>${propertyAddress}</strong> has been marked as: <strong>${status}</strong>.</p>
    <p>Best regards,<br/>The Cereno Homes Team</p>
  `;
  await sendEmail(to, subject, html);
};
