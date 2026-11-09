import { Router } from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { sendPaymentReceipt } from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY?.trim() || 'sk_test_placeholder';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim() || 'sk_test_placeholder';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim();

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Helper function to handle successful payment idempotently across all providers
async function handleSuccessfulPayment(tx: any, {
  reference,
  sessionId,
  amount,
  currency,
  paymentPlanId,
  propertyInterestId,
  invoiceId,
  authorization
}: {
  reference: string;
  sessionId?: string;
  amount: number;
  currency: string;
  paymentPlanId?: string;
  propertyInterestId?: string;
  invoiceId?: string;
  authorization?: any;
}) {
  const payment = await tx.payment.findFirst({
    where: {
      OR: [
        { providerTransactionId: reference },
        sessionId ? { providerTransactionId: sessionId } : undefined
      ].filter(Boolean) as any
    }
  });

  // Idempotency check: if payment doesn't exist or is already processed, skip
  if (!payment || payment.status === 'SUCCESS') {
    return;
  }

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: 'SUCCESS',
      settledAmount: amount,
      settledCurrency: currency
    }
  });

  if (paymentPlanId) {
    const plan = await tx.paymentPlan.findUnique({
      where: { id: paymentPlanId },
      include: { client: true }
    });

    if (plan) {
      let equityPortion = amount;
      let rentPortion = 0;

      if (plan.type === 'RENT_TO_OWN') {
        const schedule = plan.scheduleDetails as any;
        const rentDeduction = schedule?.rentDeductionAmount || 0;

        if (amount > rentDeduction) {
          rentPortion = rentDeduction;
          equityPortion = amount - rentDeduction;
        } else {
          rentPortion = amount;
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
          amountGHS: amount,
          paymentId: payment.id,
        }
      });

      if (equityPortion > 0) {
        await tx.paymentPlan.update({
          where: { id: paymentPlanId },
          data: {
            equityAccrued: { increment: equityPortion }
          }
        });
      }

      if (plan.client && plan.client.email) {
        await sendPaymentReceipt(plan.client.email, amount, currency, plan.id);
      }

      if (propertyInterestId) {
        await tx.propertyInterest.update({
          where: { id: propertyInterestId },
          data: { status: 'APPROVED' }
        });
      }

      if (invoiceId) {
        try {
          await tx.invoice.update({
            where: { id: invoiceId },
            data: { isPaid: true }
          });
        } catch (invErr) {
          console.warn('Could not mark invoice as paid in webhook:', invErr);
        }
      }

      if (authorization && authorization.reusable) {
        const existingCard = await tx.savedCard.findFirst({
          where: {
            clientId: plan.clientId,
            authorizationCode: authorization.authorization_code
          }
        });

        if (!existingCard) {
          await tx.savedCard.create({
            data: {
              clientId: plan.clientId,
              authorizationCode: authorization.authorization_code,
              last4: authorization.last4,
              cardType: authorization.card_type,
              expMonth: authorization.exp_month,
              expYear: authorization.exp_year,
              bank: authorization.bank
            }
          });
        }
      }
    }
  }
}

// Stripe Webhook Endpoint
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    const rawBody = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    if (STRIPE_WEBHOOK_SECRET && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig as string, STRIPE_WEBHOOK_SECRET);
    } else {
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
  } catch (err: any) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') {
        const reference = session.client_reference_id || session.metadata?.reference || session.id;
        const settledAmount = (session.amount_total || 0) / 100;
        const settledCurrency = (session.currency || 'usd').toUpperCase();
        const paymentPlanId = session.metadata?.paymentPlanId;
        const propertyInterestId = session.metadata?.propertyInterestId;
        const invoiceId = session.metadata?.invoiceId;

        let authorization: any = null;
        if (session.payment_intent) {
          try {
            const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;
            const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['payment_method'] });
            const pm = pi.payment_method as Stripe.PaymentMethod | null;
            if (pm && pm.card) {
              authorization = {
                reusable: true,
                authorization_code: pm.id,
                last4: pm.card.last4,
                card_type: pm.card.brand,
                exp_month: String(pm.card.exp_month),
                exp_year: String(pm.card.exp_year),
                bank: pm.card.issuer || pm.card.brand,
              };
            }
          } catch (e) {
            console.warn('Could not extract payment method in webhook:', e);
          }
        }

        await prisma.$transaction(async (tx) => {
          await handleSuccessfulPayment(tx, {
            reference,
            sessionId: session.id,
            amount: settledAmount,
            currency: settledCurrency,
            paymentPlanId,
            propertyInterestId,
            invoiceId,
            authorization,
          });
        });
      }
    } else if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const reference = paymentIntent.metadata?.reference || paymentIntent.id;
      const settledAmount = (paymentIntent.amount_received || paymentIntent.amount) / 100;
      const settledCurrency = (paymentIntent.currency || 'usd').toUpperCase();
      const paymentPlanId = paymentIntent.metadata?.paymentPlanId;
      const propertyInterestId = paymentIntent.metadata?.propertyInterestId;
      const invoiceId = paymentIntent.metadata?.invoiceId;

      await prisma.$transaction(async (tx) => {
        await handleSuccessfulPayment(tx, {
          reference,
          amount: settledAmount,
          currency: settledCurrency,
          paymentPlanId,
          propertyInterestId,
          invoiceId,
        });
      });
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook handling error:', error);
    res.status(500).send('Webhook handling error');
  }
});

// Legacy Paystack Webhook
router.post('/paystack', async (req, res) => {
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
    const settledAmount = data.amount / 100;
    const settledCurrency = data.currency;
    const paymentPlanId = data.metadata?.paymentPlanId;
    const propertyInterestId = data.metadata?.propertyInterestId;

    try {
      await prisma.$transaction(async (tx) => {
        await handleSuccessfulPayment(tx, {
          reference,
          amount: settledAmount,
          currency: settledCurrency,
          paymentPlanId,
          propertyInterestId,
          authorization: data.authorization
        });
      });
    } catch (error) {
      console.error('Webhook processing error:', error);
      return res.status(500).send('Webhook processing error');
    }
  }

  res.status(200).send('Webhook received');
});

export default router;
