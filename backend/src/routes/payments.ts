import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { PaymentFactory } from '../services/paymentFactory';

const router = Router();
const prisma = new PrismaClient();

// In a real app, this would be authenticated
router.post('/initialize', async (req, res) => {
  const { paymentPlanId, amount, currency = 'USD', channel, callbackUrl, provider = 'stripe' } = req.body;

  try {
    const paymentPlan = await prisma.paymentPlan.findUnique({
      where: { id: paymentPlanId },
      include: { client: true },
    });

    if (!paymentPlan) {
      return res.status(404).json({ error: 'Payment plan not found' });
    }

    const effectiveCurrency = currency || paymentPlan.currency || 'USD';
    let chargeAmount = amount;
    let chargeCurrency = effectiveCurrency;

    // If using Paystack legacy, convert to GHS
    if (provider.toLowerCase() === 'paystack') {
      const EXCHANGE_RATES: Record<string, number> = {
        'USD': 15.00,
        'EUR': 16.50,
        'GHS': 1.00
      };
      const rate = EXCHANGE_RATES[effectiveCurrency] || 1;
      chargeAmount = amount * rate;
      chargeCurrency = 'GHS';
    }

    // Create a pending payment record
    const payment = await prisma.payment.create({
      data: {
        provider: provider.toUpperCase(),
        providerTransactionId: `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        status: 'PENDING',
        originalCurrency: effectiveCurrency,
        originalAmount: amount,
      },
    });

    // Initialize payment using the selected provider factory (Stripe by default)
    const paymentProvider = PaymentFactory.getProvider(provider);
    const paymentData = await paymentProvider.initializePayment(
      paymentPlan.client.email,
      chargeAmount,
      chargeCurrency, 
      payment.providerTransactionId,
      callbackUrl,
      { paymentPlanId }
    );

    res.json({
      message: 'Payment initialized successfully',
      authorization_url: paymentData.authorization_url || paymentData.checkoutUrl,
      access_code: paymentData.access_code || paymentData.sessionId,
      sessionId: paymentData.sessionId,
      reference: paymentData.reference || payment.providerTransactionId,
    });
  } catch (error: any) {
    console.error('Payment initialization error:', error);
    res.status(500).json({ error: error.message || 'Internal server error during payment initialization' });
  }
});

router.post('/verify', async (req, res) => {
  const { reference, session_id, provider = 'stripe' } = req.body;
  const lookupRef = session_id || reference;
  if (!lookupRef) return res.status(400).json({ error: 'Reference or session_id is required' });

  try {
    const paymentProvider = PaymentFactory.getProvider(provider);
    const data = await paymentProvider.verifyPayment(lookupRef);
    
    if (data.status === 'success') {
      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: {
            OR: [
              { providerTransactionId: reference },
              { providerTransactionId: session_id },
              { providerTransactionId: data.reference },
              { providerTransactionId: data.sessionId },
            ].filter(Boolean) as any,
          },
        });
        
        if (!payment || payment.status === 'SUCCESS') return;
        
        const settledAmount = data.amount / 100;
        
        await tx.payment.update({
          where: { id: payment.id },
          data: { 
            status: 'SUCCESS',
            settledAmount: settledAmount,
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
              let equityPortion = settledAmount;
              let rentPortion = 0;
              
              if (plan.type === 'RENT_TO_OWN') {
                const schedule = plan.scheduleDetails as any;
                const rentDeduction = schedule?.rentDeductionAmount || 0;
                
                if (settledAmount > rentDeduction) {
                  rentPortion = rentDeduction;
                  equityPortion = settledAmount - rentDeduction;
                } else {
                  rentPortion = settledAmount;
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
                  amountGHS: settledAmount,
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
                // sendPaymentReceipt(plan.client.email, settledAmount, data.currency, plan.id);
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
  const { paymentPlanId, amount, currency = 'USD', savedCardId, provider = 'stripe' } = req.body;
  
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
        provider: provider.toUpperCase(),
        providerTransactionId: `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`, 
        status: 'PENDING',
        originalCurrency: currency,
        originalAmount: amount,
      },
    });

    const paymentProvider = PaymentFactory.getProvider(provider);
    if (!paymentProvider.chargeAuthorization) {
       return res.status(400).json({ error: 'Provider does not support charging saved cards' });
    }
    const chargeData = await paymentProvider.chargeAuthorization(
      plan.client.email,
      amount,
      currency,
      payment.providerTransactionId,
      savedCard.authorizationCode,
      { paymentPlanId }
    );
    
    if (chargeData.status === 'success') {
      res.json({
        message: 'Payment charged successfully',
        status: 'success',
        reference: chargeData.reference
      });
    } else {
      res.status(400).json({ error: 'Failed to charge card', details: chargeData });
    }
  } catch (error: any) {
    console.error('Error charging saved card:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
