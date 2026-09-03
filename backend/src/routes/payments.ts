import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { initializePayment, verifyPayment, chargeAuthorization } from '../services/paystack';

const router = Router();
const prisma = new PrismaClient();

// In a real app, this would be authenticated
router.post('/initialize', async (req, res) => {
  const { paymentPlanId, amount, currency = 'GHS', channel, callbackUrl } = req.body;

  try {
    const paymentPlan = await prisma.paymentPlan.findUnique({
      where: { id: paymentPlanId },
      include: { client: true },
    });

    if (!paymentPlan) {
      return res.status(404).json({ error: 'Payment plan not found' });
    }

    // Mock Exchange Rates
    const EXCHANGE_RATES: Record<string, number> = {
      'USD': 15.00,
      'EUR': 16.50,
      'GHS': 1.00
    };

    const rate = EXCHANGE_RATES[currency] || 1;
    const amountGHS = amount * rate;

    // Create a pending payment record
    const payment = await prisma.payment.create({
      data: {
        provider: 'PAYSTACK',
        providerTransactionId: `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`, // Temporary reference, real one should be robust
        status: 'PENDING',
        originalCurrency: currency,
        originalAmount: amount,
      },
    });

    // Initialize Paystack payment (Paystack will charge the calculated GHS amount)
    const paystackData = await initializePayment(
      paymentPlan.client.email,
      amountGHS,
      'GHS', // Always initialize with GHS to Paystack since it's the Cedi equivalent
      payment.providerTransactionId,
      callbackUrl,
      { paymentPlanId }
    );

    res.json({
      message: 'Payment initialized successfully',
      authorization_url: paystackData.authorization_url,
      access_code: paystackData.access_code,
      reference: paystackData.reference,
    });
  } catch (error: any) {
    console.error('Payment initialization error:', error);
    res.status(500).json({ error: 'Internal server error during payment initialization' });
  }
});

router.post('/verify', async (req, res) => {
  const { reference } = req.body;
  if (!reference) return res.status(400).json({ error: 'Reference is required' });

  try {
    const data = await verifyPayment(reference);
    
    if (data.status === 'success') {
      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { providerTransactionId: reference },
        });
        
        if (!payment || payment.status === 'SUCCESS') return;
        
        const settledAmountGHS = data.amount / 100;
        
        await tx.payment.update({
          where: { id: payment.id },
          data: { 
            status: 'SUCCESS',
            settledAmount: settledAmountGHS,
            settledCurrency: data.currency
          }
        });
        
        const paymentPlanId = data.metadata?.paymentPlanId;
        
        if (paymentPlanId) {
           const plan = await tx.paymentPlan.findUnique({ 
             where: { id: paymentPlanId },
             include: { client: true }
           });
           
           if (plan) {
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
                
                if (rentPortion > 0) {
                  await tx.ledgerEntry.create({
                    data: {
                      paymentPlanId,
                      type: 'RENT_DEDUCTION',
                      amountGHS: -rentPortion,
                      paymentId: payment.id,
                    }
                  });
                }
              }

              await tx.ledgerEntry.create({
                data: {
                  paymentPlanId,
                  type: 'PAYMENT',
                  amountGHS: settledAmountGHS,
                  paymentId: payment.id,
                }
              });
              
              if (equityPortion > 0) {
                await tx.paymentPlan.update({
                  where: { id: paymentPlanId },
                  data: { equityAccrued: { increment: equityPortion } }
                });
              }
              
              if (plan.client && plan.client.email) {
                // sendPaymentReceipt(plan.client.email, settledAmountGHS, data.currency, plan.id);
                // skipped email in verify to avoid duplicate if webhook also fires
              }
              
              // Save reusable card if provided
              if (data.authorization && data.authorization.reusable) {
                const {
                  authorization_code,
                  last4,
                  card_type,
                  exp_month,
                  exp_year,
                  bank
                } = data.authorization;
                
                // Only save if it doesn't already exist for this client
                const existingCard = await tx.savedCard.findFirst({
                  where: {
                    clientId: plan.clientId,
                    authorizationCode: authorization_code
                  }
                });
                
                if (!existingCard) {
                  await tx.savedCard.create({
                    data: {
                      clientId: plan.clientId,
                      authorizationCode: authorization_code,
                      last4,
                      cardType: card_type,
                      expMonth: exp_month,
                      expYear: exp_year,
                      bank
                    }
                  });
                }
              }
           }
        }
      });
      return res.json({ message: 'Payment verified successfully', status: 'success' });
    } else {
      return res.status(400).json({ error: 'Payment not successful' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Internal server error during verification' });
  }
});

});

// Endpoint to fetch saved cards for a client via their payment plan id
router.get('/saved-cards/:paymentPlanId', async (req, res) => {
  const { paymentPlanId } = req.params;
  try {
    const plan = await prisma.paymentPlan.findUnique({
      where: { id: paymentPlanId },
    });
    
    if (!plan) return res.status(404).json({ error: 'Payment plan not found' });
    
    const savedCards = await prisma.savedCard.findMany({
      where: { clientId: plan.clientId },
      select: {
        id: true,
        last4: true,
        cardType: true,
        expMonth: true,
        expYear: true,
        bank: true,
      }
    });
    
    res.json({ savedCards });
  } catch (error) {
    console.error('Error fetching saved cards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to charge a saved card
router.post('/charge-saved-card', async (req, res) => {
  const { paymentPlanId, amount, currency = 'GHS', savedCardId } = req.body;
  
  try {
    const plan = await prisma.paymentPlan.findUnique({
      where: { id: paymentPlanId },
      include: { client: true }
    });
    
    if (!plan) return res.status(404).json({ error: 'Payment plan not found' });
    
    const savedCard = await prisma.savedCard.findUnique({
      where: { id: savedCardId }
    });
    
    if (!savedCard || savedCard.clientId !== plan.clientId) {
      return res.status(403).json({ error: 'Unauthorized or invalid saved card' });
    }
    
    // Create a pending payment record
    const payment = await prisma.payment.create({
      data: {
        provider: 'PAYSTACK',
        providerTransactionId: `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`, 
        status: 'PENDING',
        originalCurrency: currency,
        originalAmount: amount,
      },
    });

    const EXCHANGE_RATES: Record<string, number> = {
      'USD': 15.00,
      'EUR': 16.50,
      'GHS': 1.00
    };
    const rate = EXCHANGE_RATES[currency] || 1;
    const amountGHS = amount * rate;
    
    // Charge the authorization
    const paystackData = await chargeAuthorization(
      plan.client.email,
      amountGHS,
      'GHS',
      payment.providerTransactionId,
      savedCard.authorizationCode,
      { paymentPlanId }
    );
    
    if (paystackData.status === 'success') {
      // Typically you'd call a verify or handle it inline. For now we can rely on webhook or call verify manually.
      // But Paystack might also return success directly. 
      // It's safest to instruct the client to call /verify with the reference.
      res.json({
        message: 'Payment charged successfully',
        status: 'success',
        reference: paystackData.reference
      });
    } else {
      res.status(400).json({ error: 'Failed to charge card', details: paystackData });
    }
  } catch (error) {
    console.error('Error charging saved card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
