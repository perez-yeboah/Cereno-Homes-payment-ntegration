import PDFDocument from 'pdfkit';
import { Response } from 'express';

export const generateReceiptPDF = (
  res: Response, 
  receiptData: { 
    clientName: string,
    propertyAddress: string,
    paymentId: string,
    amountGHS: number,
    originalCurrency: string,
    originalAmount: number,
    date: Date,
    planType: string
  }
) => {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=receipt_${receiptData.paymentId}.pdf`);

  doc.pipe(res);

  // Header
  doc
    .fillColor('#444444')
    .fontSize(20)
    .text('Cereno Homes', 50, 57)
    .fontSize(10)
    .text('CBS Group of Companies', 200, 50, { align: 'right' })
    .text('Accra, Ghana', 200, 65, { align: 'right' })
    .moveDown();

  doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, 90).lineTo(550, 90).stroke();

  // Receipt Details
  doc
    .fontSize(16)
    .fillColor('#000000')
    .text('Payment Receipt', 50, 110)
    .fontSize(10)
    .text(`Receipt Number: ${receiptData.paymentId}`, 50, 140)
    .text(`Date: ${receiptData.date.toDateString()}`, 50, 155)
    .moveDown();

  // Client Details
  doc
    .text(`Billed To: ${receiptData.clientName}`, 50, 185)
    .text(`Property: ${receiptData.propertyAddress}`, 50, 200)
    .text(`Plan Type: ${receiptData.planType.replace('_', ' ')}`, 50, 215)
    .moveDown();

  // Payment Breakdown
  doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, 245).lineTo(550, 245).stroke();

  doc
    .fontSize(12)
    .text('Description', 50, 260)
    .text('Amount', 400, 260, { align: 'right' });

  doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, 280).lineTo(550, 280).stroke();

  doc
    .fontSize(10)
    .text('Installment / Payment', 50, 300)
    .text(`GHS ${receiptData.amountGHS.toFixed(2)}`, 400, 300, { align: 'right' });

  // If paid in a foreign currency, show the original amount
  if (receiptData.originalCurrency !== 'GHS') {
    doc
      .fillColor('#777777')
      .text(`(Paid as ${receiptData.originalCurrency} ${receiptData.originalAmount.toFixed(2)})`, 50, 315);
  }

  doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, 340).lineTo(550, 340).stroke();

  // Total
  doc
    .fontSize(14)
    .fillColor('#000000')
    .text('Total Settled:', 250, 360, { align: 'right' })
    .text(`GHS ${receiptData.amountGHS.toFixed(2)}`, 400, 360, { align: 'right' });

  // Footer
  doc
    .fontSize(10)
    .fillColor('#777777')
    .text('Thank you for choosing Cereno Homes.', 50, 700, { align: 'center', width: 500 });

  doc.end();
};
