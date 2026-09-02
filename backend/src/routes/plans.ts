import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Create a new Payment Plan
router.post('/', async (req, res) => {
  const { clientId, propertyId, type, totalAmount, currency, scheduleDetails } = req.body;

  try {
    const plan = await prisma.paymentPlan.create({
      data: {
        clientId,
        propertyId,
        type, // 'RENT_TO_OWN' | 'PAY_TO_OWN'
        totalAmount,
        currency: currency || 'GHS',
        scheduleDetails,
      },
    });

    res.status(201).json(plan);
  } catch (error: any) {
    console.error('Error creating payment plan:', error);
    res.status(500).json({ error: 'Internal server error while creating payment plan' });
  }
});

// Retrieve a client's ledger for a specific plan
router.get('/:id/ledger', async (req, res) => {
  const { id } = req.params;

  try {
    const plan = await prisma.paymentPlan.findUnique({
      where: { id },
      include: {
        property: true,
        ledgerEntries: {
          orderBy: { transactionDate: 'desc' },
          include: { payment: true },
        },
      },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Payment plan not found' });
    }

    // Calculate balances
    const totalPaid = plan.ledgerEntries
      .filter((e) => e.type === 'PAYMENT')
      .reduce((sum, e) => sum + Number(e.amountGHS), 0);
      
    const balanceRemaining = Number(plan.totalAmount) - totalPaid;

    res.json({
      planDetails: {
        type: plan.type,
        status: plan.status,
        totalAmount: plan.totalAmount,
        currency: plan.currency,
        equityAccrued: plan.equityAccrued,
        totalPaid,
        balanceRemaining,
      },
      property: plan.property,
      ledgerEntries: plan.ledgerEntries,
    });
  } catch (error: any) {
    console.error('Error fetching ledger:', error);
    res.status(500).json({ error: 'Internal server error while fetching ledger' });
  }
});

export default router;
