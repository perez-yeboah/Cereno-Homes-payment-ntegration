import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, PlanType } from '@prisma/client';
import { z } from 'zod';
import { authenticateClient, AuthRequest } from '../middleware/auth';

import { initializePayment } from '../services/paystack';

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
    res.json(properties);
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

      return {
        ...plan,
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
        currency: property.currency,
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
  initialDepositPercentage: z.number().refine(val => val === 30 || val === 50, {
    message: "Initial deposit must be either 30% or 50%"
  }).optional()
});

// Submit Application (Show Interest)
router.post('/interests', authenticateClient, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user?.id;
    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { propertyId, submittedData, initialDepositPercentage } = InterestCreateSchema.parse(req.body);

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

    // If a deposit percentage was provided, we generate a payment plan and initialize payment
    if (initialDepositPercentage) {
      // 2. Create the PaymentPlan automatically
      const paymentPlan = await prisma.paymentPlan.create({
        data: {
          clientId,
          propertyId,
          type: planType,
          totalAmount: property.basePrice,
          equityAccrued: 0,
          currency: property.currency,
          status: 'ACTIVE',
          scheduleDetails: {},
        }
      });

      // 3. Initialize Paystack Payment for the Deposit
      const EXCHANGE_RATES: Record<string, number> = {
        'USD': 15.00,
        'EUR': 16.50,
        'GHS': 1.00
      };
      const rate = EXCHANGE_RATES[property.currency] || 1;
      const basePriceNumber = Number(property.basePrice);
      const amountInOriginalCurrency = basePriceNumber * (initialDepositPercentage / 100);
      const amountGHS = amountInOriginalCurrency * rate;

      const payment = await prisma.payment.create({
        data: {
          provider: 'PAYSTACK',
          providerTransactionId: `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          status: 'PENDING',
          originalCurrency: property.currency,
          originalAmount: amountInOriginalCurrency,
        },
      });

      const callbackUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/dashboard` : 'http://localhost:5173/dashboard';

      const paystackData = await initializePayment(
        client.email,
        amountGHS,
        'GHS',
        payment.providerTransactionId,
        callbackUrl,
        { paymentPlanId: paymentPlan.id, propertyInterestId: interest.id }
      );

      return res.status(201).json({
        interest,
        paymentPlan,
        payment: {
          authorization_url: paystackData.authorization_url,
          access_code: paystackData.access_code,
          reference: paystackData.reference
        }
      });
    }

    res.status(201).json({ interest });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Interest creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
