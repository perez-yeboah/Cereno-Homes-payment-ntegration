import nodemailer from 'nodemailer';

const isGmail = process.env.SMTP_SERVICE?.toLowerCase() === 'gmail' || process.env.SMTP_HOST?.includes('gmail.com');

const transporter = nodemailer.createTransport(
  isGmail
    ? {
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS, // 16-character Google App Password
        },
      }
    : {
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        } : undefined,
      }
);

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const fromAddress = process.env.SMTP_FROM || `"Cereno Homes" <${process.env.SMTP_USER || 'no-reply@cerenohomes.com'}>`;
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
    });
    console.log('[EmailService] Message sent: %s', info.messageId);
    if (!process.env.SMTP_HOST || process.env.SMTP_HOST === 'smtp.ethereal.email') {
      console.log('[EmailService] Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error('[EmailService] Error sending email:', error);
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

export const sendInvoicePaymentLinkEmail = async (
  to: string,
  clientName: string,
  amount: number,
  currency: string,
  dueDate: string,
  paymentLink: string,
  description?: string,
  propertyAddress?: string
) => {
  const subject = `Invoice & Payment Link - Cereno Homes`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a;">Cereno Homes Payment Request</h2>
      <p>Hello <strong>${clientName}</strong>,</p>
      <p>An invoice has been generated for your property${propertyAddress ? ` at <strong>${propertyAddress}</strong>` : ''}.</p>
      
      <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Amount Due:</strong> ${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        <p style="margin: 0 0 8px 0;"><strong>Due Date:</strong> ${dueDate}</p>
        ${description ? `<p style="margin: 0;"><strong>Details:</strong> ${description}</p>` : ''}
      </div>

      <p>Click the secure link below to make your payment directly with Stripe (Credit/Debit Card, Apple Pay, Google Pay):</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${paymentLink}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Pay Invoice Now
        </a>
      </div>

      <p style="font-size: 13px; color: #64748b;">Or copy and paste this link into your browser:<br/><a href="${paymentLink}">${paymentLink}</a></p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Cereno Homes &bull; Premium Real Estate Solutions</p>
    </div>
  `;
  await sendEmail(to, subject, html);
};
