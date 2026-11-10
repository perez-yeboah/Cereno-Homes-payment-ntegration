import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, PlanType } from '@prisma/client';
import { z } from 'zod';
import { authenticateClient, AuthRequest } from '../middleware/auth';

import { PaymentFactory } from '../services/paymentFactory';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dev_key';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  phone: z.string().min(10)
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// Client Registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone } = RegisterSchema.parse(req.body);

    const existingClient = await prisma.client.findUnique({ where: { email } });
    if (existingClient) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const client = await prisma.client.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone
      }
    });

    const token = jwt.sign({ id: client.id, email: client.email, type: 'CLIENT' }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, client: { id: client.id, email: client.email, name: client.name } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Client Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const client = await prisma.client.findUnique({ where: { email } });
    if (!client || !client.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, client.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: client.id, email: client.email, type: 'CLIENT' }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, client: { id: client.id, email: client.email, name: client.name } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch Available Properties (Public)
router.get('/properties', async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      where: { status: 'AVAILABLE' }
    });
    const normalized = properties.map(p => ({
      ...p,
      currency: (p.currency && p.currency !== 'GHS') ? p.currency : 'USD'
    }));
    res.json(normalized);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Client Payment Plans
router.get('/plans', authenticateClient, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user?.id;
    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    const plans = await prisma.paymentPlan.findMany({
      where: { clientId },
      include: {
        property: true,
        ledgerEntries: {
          orderBy: { transactionDate: 'desc' },
          include: { payment: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const enrichedPlans = plans.map(plan => {
      const totalPaid = plan.ledgerEntries
        .filter((e) => e.type === 'PAYMENT')
        .reduce((sum, e) => sum + Number(e.amountGHS), 0);
      const balanceRemaining = Number(plan.totalAmount) - totalPaid;
      const effectiveCurrency = (plan.currency && plan.currency !== 'GHS') 
        ? plan.currency 
        : (plan.property?.currency && plan.property?.currency !== 'GHS') 
          ? plan.property.currency 
          : 'USD';

      return {
        ...plan,
        currency: effectiveCurrency,
        totalPaid,
        balanceRemaining
      };
    });

    res.json(enrichedPlans);
  } catch (error) {
    console.error('Error fetching client plans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Payment Plan (Authenticated Client)
const PlanCreateSchema = z.object({
  propertyId: z.string().uuid(),
  type: z.enum(['RENT_TO_OWN', 'PAY_TO_OWN'])
});

router.post('/plans', authenticateClient, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user?.id;
    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    const { propertyId, type } = PlanCreateSchema.parse(req.body);

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.status !== 'AVAILABLE') {
      return res.status(400).json({ error: 'Property not available' });
    }

    // Create the plan
    const plan = await prisma.paymentPlan.create({
      data: {
        clientId,
        propertyId,
        type: type as PlanType,
        totalAmount: property.basePrice,
        currency: (property.currency && property.currency !== 'GHS') ? property.currency : 'USD',
        scheduleDetails: { createdByClient: true, initialPayment: true },
        status: 'ACTIVE'
      }
    });

    // Mark property as reserved (using RENTED or SOLD based on type, using RENTED as placeholder)
    await prisma.property.update({
      where: { id: propertyId },
      data: { status: type === 'RENT_TO_OWN' ? 'RENTED' : 'SOLD' }
    });

    // Generate initial invoice (e.g. 5% deposit for pay-to-own, or first month rent for rent-to-own)
    const amountDue = type === 'PAY_TO_OWN' 
      ? Number(property.basePrice) * 0.05 // 5% deposit
      : Number(property.basePrice) / 120; // Example: 10 year term monthly

    const invoice = await prisma.invoice.create({
      data: {
        paymentPlanId: plan.id,
        amountDue,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      }
    });

    res.status(201).json({ plan, invoice });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Plan creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const InterestCreateSchema = z.object({
  propertyId: z.string().uuid(),
  submittedData: z.record(z.string(), z.any()),
  initialDepositPercentage: z.number().min(1).max(100).optional(),
  paymentMethod: z.enum(['STRIPE', 'WIRE']).optional().default('STRIPE'),
  provider: z.string().optional().default('stripe'),
  isFullPayment: z.boolean().optional().default(false),
  trancheCount: z.number().optional().default(1),
  trancheIndex: z.number().optional().default(1),
});

// Submit Application (Show Interest)
router.post('/interests', authenticateClient, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user?.id;
    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { 
      propertyId, 
      submittedData, 
      initialDepositPercentage, 
      paymentMethod = 'STRIPE', 
      provider = 'stripe',
      isFullPayment = false,
      trancheCount = 1,
      trancheIndex = 1
    } = InterestCreateSchema.parse(req.body);

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.status !== 'AVAILABLE') {
      return res.status(400).json({ error: 'Property not available' });
    }

    const activeInterest = await prisma.propertyInterest.findFirst({
      where: {
        clientId,
        propertyId,
        status: { in: ['PENDING', 'APPROVED'] }
      }
    });

    if (activeInterest) {
      return res.status(400).json({ error: 'You already have an active application for this property.' });
    }

    // Default to PAY_TO_OWN if not provided, though the frontend should send it in submittedData
    const planType = submittedData?.type === 'RENT_TO_OWN' ? 'RENT_TO_OWN' : 'PAY_TO_OWN';

    // 1. Create the PropertyInterest (Application)
    const interest = await prisma.propertyInterest.create({
      data: {
        clientId,
        propertyId,
        submittedData,
        status: 'PENDING'
      }
    });

    const basePriceNumber = Number(property.basePrice);
    const targetCurrency = (property.currency && property.currency !== 'GHS') ? property.currency : 'USD';

    // If Bank Wire was selected
    if (paymentMethod === 'WIRE') {
      const depositPct = initialDepositPercentage || (isFullPayment ? 100 : 30);
      const wireAmount = isFullPayment ? basePriceNumber : basePriceNumber * (depositPct / 100);

      // Create active PaymentPlan
      const paymentPlan = await prisma.paymentPlan.create({
        data: {
          clientId,
          propertyId,
          type: planType,
          totalAmount: property.basePrice,
          equityAccrued: 0,
          currency: targetCurrency,
          status: 'ACTIVE',
          scheduleDetails: { paymentMethod: 'WIRE', depositPct, isFullPayment },
        }
      });

      const wireRef = `WIRE_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`;

      // Create a pending wire payment record
      await prisma.payment.create({
        data: {
          provider: 'MANUAL_WIRE',
          providerTransactionId: wireRef,
          status: 'PENDING',
          originalCurrency: targetCurrency,
          originalAmount: wireAmount,
        }
      });

      // Create an invoice for the wire payment
      const invoice = await prisma.invoice.create({
        data: {
          paymentPlanId: paymentPlan.id,
          amountDue: wireAmount,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days for wire arrival
          isPaid: false,
        }
      });

      return res.status(201).json({
        interest,
        paymentPlan,
        invoice,
        wireTransfer: {
          reference: wireRef,
          amount: wireAmount,
          currency: targetCurrency,
          bankName: "Standard Chartered Bank / Guaranty Trust Bank (Ghana)",
          accountName: "Cereno Homes Limited",
          accountNumber: "0100234891100",
          swiftCode: "SCBLGHAC",
          routingNumber: "020101",
          instructions: "Please include the reference code in your bank transfer narration. Once received, your payment plan will be marked as paid and an official receipt will be generated."
        }
      });
    }

    // If a deposit percentage or full payment via Stripe was provided
    if (initialDepositPercentage || isFullPayment) {
      // 2. Create the PaymentPlan automatically
      const paymentPlan = await prisma.paymentPlan.create({
        data: {
          clientId,
          propertyId,
          type: planType,
          totalAmount: property.basePrice,
          equityAccrued: 0,
          currency: targetCurrency,
          status: 'ACTIVE',
          scheduleDetails: { initialDepositPercentage, isFullPayment, trancheCount },
        }
      });

      // Calculate amount for this transaction
      let amountInOriginalCurrency: number;
      if (isFullPayment) {
        amountInOriginalCurrency = basePriceNumber / Math.max(1, trancheCount);
      } else {
        const pct = initialDepositPercentage || 30;
        amountInOriginalCurrency = basePriceNumber * (pct / 100);
      }

      let chargeAmount = amountInOriginalCurrency;
      let chargeCurrency = targetCurrency;

      if (provider.toLowerCase() === 'paystack') {
        const EXCHANGE_RATES: Record<string, number> = {
          'USD': 15.00,
          'EUR': 16.50,
          'GHS': 1.00
        };
        const rate = EXCHANGE_RATES[targetCurrency] || 1;
        chargeAmount = amountInOriginalCurrency * rate;
        chargeCurrency = 'GHS';
      }

      // Check Stripe limit ($999,999.99)
      if (provider.toLowerCase() === 'stripe' && chargeAmount > 999999.99) {
        return res.status(400).json({ 
          error: `Single online payment of ${chargeAmount.toLocaleString('en-US', { style: 'currency', currency: chargeCurrency })} exceeds Stripe's $999,999.99 transaction limit. Please select a lower deposit percentage (e.g. 10% - 25%), split into tranches, or choose Bank Wire Transfer.`
        });
      }

      // Create an Invoice for this tranche/deposit
      const invoice = await prisma.invoice.create({
        data: {
          paymentPlanId: paymentPlan.id,
          amountDue: amountInOriginalCurrency,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isPaid: false,
        }
      });

      const payment = await prisma.payment.create({
        data: {
          provider: provider.toUpperCase(),
          providerTransactionId: `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          status: 'PENDING',
          originalCurrency: targetCurrency,
          originalAmount: amountInOriginalCurrency,
        },
      });

      const callbackUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/payment/verify` : 'http://localhost:5173/payment/verify';

      const description = isFullPayment && trancheCount > 1
        ? `Cereno Homes - Full Purchase (Tranche ${trancheIndex} of ${trancheCount})`
        : `Cereno Homes - Initial Deposit (${initialDepositPercentage || 30}%)`;

      const paymentProvider = PaymentFactory.getProvider(provider);
      const paymentData = await paymentProvider.initializePayment(
        client.email,
        chargeAmount,
        chargeCurrency,
        payment.providerTransactionId,
        callbackUrl,
        { 
          paymentPlanId: paymentPlan.id, 
          propertyInterestId: interest.id,
          invoiceId: invoice.id,
          description 
        }
      );

      return res.status(201).json({
        interest,
        paymentPlan,
        invoice,
        payment: {
          authorization_url: paymentData.authorization_url || paymentData.checkoutUrl,
          access_code: paymentData.access_code || paymentData.sessionId,
          sessionId: paymentData.sessionId,
          reference: paymentData.reference || payment.providerTransactionId
        }
      });
    }

    res.status(201).json({ interest });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Interest creation error:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

// Get My Applications (Interests)
router.get('/interests', authenticateClient, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user?.id;
    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    const interests = await prisma.propertyInterest.findMany({
      where: { clientId },
      include: { property: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(interests);
  } catch (error) {
    console.error('Error fetching interests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel Application (Interest)
router.patch('/interests/:id/cancel', authenticateClient, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user?.id;
    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    const interestId = req.params.id as string;
    const interest = await prisma.propertyInterest.findFirst({
      where: { id: interestId, clientId }
    });

    if (!interest) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (interest.status !== 'PENDING' && interest.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Cannot cancel an application in this status' });
    }

    const updated = await prisma.propertyInterest.update({
      where: { id: interestId },
      data: { status: 'CANCELLED' }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error cancelling interest:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
