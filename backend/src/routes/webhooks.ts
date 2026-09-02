import { Router } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { sendPaymentReceipt } from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_placeholder';

router.post('/paystack', async (req, res) => {
  // Validate Paystack signature
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
                     .update(JSON.stringify(req.body))
                     .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;
  
  if (event.event === 'charge.success') {
    const data = event.data;
    const reference = data.reference;
    
    try {
      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { providerTransactionId: reference },
        });
        
        // Idempotency check: if payment doesn't exist or is already processed, skip
        if (!payment || payment.status === 'SUCCESS') {
          return;
        }
        
        const settledAmountGHS = data.amount / 100; // Paystack sends amounts in smallest unit (kobo/pesewas)
        
        await tx.payment.update({
          where: { id: payment.id },
          data: { 
            status: 'SUCCESS',
            settledAmount: settledAmountGHS,
            settledCurrency: data.currency
          }
        });
        
        // We expect paymentPlanId to be passed in the metadata during initialization
        const paymentPlanId = data.metadata?.paymentPlanId;
        
        if (paymentPlanId) {
           const plan = await tx.paymentPlan.findUnique({ 
             where: { id: paymentPlanId },
             include: { client: true }
           });
           
           if (plan) {
              // Amortization logic based on plan type
              let equityPortion = settledAmountGHS;
              let rentPortion = 0;
              
              if (plan.type === 'RENT_TO_OWN') {
                const schedule = plan.scheduleDetails as any;
                const rentDeduction = schedule?.rentDeductionAmount || 0;
                
                if (settledAmountGHS > rentDeduction) {
                  rentPortion = rentDeduction;
                  equityPortion = settledAmountGHS - rentDeduction;
                } else {
                  rentPortion = settledAmountGHS;
                  equityPortion = 0;
                }
                
                // Record the rent deduction as a separate ledger entry
                if (rentPortion > 0) {
                  await tx.ledgerEntry.create({
                    data: {
                      paymentPlanId,
                      type: 'RENT_DEDUCTION',
                      amountGHS: -rentPortion, // Negative to denote fee/deduction
                      paymentId: payment.id,
                    }
                  });
                }
              }

              // Create the immutable ledger entry for the gross payment
              await tx.ledgerEntry.create({
                data: {
                  paymentPlanId,
                  type: 'PAYMENT',
                  amountGHS: settledAmountGHS,
                  paymentId: payment.id,
                }
              });
              
              // Update accrued equity
              if (equityPortion > 0) {
                await tx.paymentPlan.update({
                  where: { id: paymentPlanId },
                  data: {
                    equityAccrued: { increment: equityPortion }
                  }
                });
              }
              
              // Send Email Receipt
              if (plan.client && plan.client.email) {
                await sendPaymentReceipt(plan.client.email, settledAmountGHS, data.currency, plan.id);
              }
           }
        }
      });
    } catch (error) {
      console.error('Webhook processing error:', error);
      return res.status(500).send('Webhook processing error');
    }
  }

  // Acknowledge receipt to Paystack
  res.status(200).send('Webhook received');
});

export default router;
