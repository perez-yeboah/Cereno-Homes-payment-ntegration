export const sendEmail = async (to: string, subject: string, body: string) => {
  // In a real application, you would integrate with SendGrid, Amazon SES, etc.
  console.log(`[EMAIL SIMULATION] To: ${to}`);
  console.log(`[EMAIL SIMULATION] Subject: ${subject}`);
  console.log(`[EMAIL SIMULATION] Body: ${body}`);
  return true;
};

export const sendSMS = async (to: string, message: string) => {
  // In a real application, you would integrate with Twilio, Africa's Talking, or Hubtel (common in Ghana)
  console.log(`[SMS SIMULATION] To: ${to}`);
  console.log(`[SMS SIMULATION] Message: ${message}`);
  return true;
};

export const notifyUpcomingInvoice = async (clientInfo: { name: string, email: string, phone: string }, invoiceDetails: { amountDue: number, dueDate: string, daysLeft: number }) => {
  const subject = `Reminder: Upcoming Payment Due for Cereno Homes - ${invoiceDetails.daysLeft} day(s) left`;
  const body = `Dear ${clientInfo.name},\n\nThis is a reminder that your payment of GHS ${invoiceDetails.amountDue} is due on ${invoiceDetails.dueDate}.\n\nPlease ensure your payment is made on time to avoid penalties.\n\nThank you,\nCereno Homes`;
  
  const sms = `Cereno Homes: Your payment of GHS ${invoiceDetails.amountDue} is due in ${invoiceDetails.daysLeft} days on ${invoiceDetails.dueDate}.`;
  
  await sendEmail(clientInfo.email, subject, body);
  await sendSMS(clientInfo.phone, sms);
};

export const notifyPenaltyApplied = async (clientInfo: { name: string, email: string, phone: string }, penaltyDetails: { penaltyAmount: number, totalDue: number }) => {
  const subject = `Notice: Penalty Applied for Late Payment - Cereno Homes`;
  const body = `Dear ${clientInfo.name},\n\nSince we have not received your payment within the grace period, a late penalty of GHS ${penaltyDetails.penaltyAmount} has been applied to your account.\n\nYour new outstanding balance for this period is GHS ${penaltyDetails.totalDue}.\n\nPlease arrange payment as soon as possible.\n\nThank you,\nCereno Homes`;
  
  const sms = `Cereno Homes: A late penalty of GHS ${penaltyDetails.penaltyAmount} has been applied. Your new total due is GHS ${penaltyDetails.totalDue}.`;
  
  await sendEmail(clientInfo.email, subject, body);
  await sendSMS(clientInfo.phone, sms);
};
