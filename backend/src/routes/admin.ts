import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateReceiptPDF } from '../services/receiptEngine';

const router = Router();
const prisma = new PrismaClient();

// Get an aggregate view of all active payment plans and balances
router.get('/balances', async (req, res) => {
  try {
    const plans = await prisma.paymentPlan.findMany({
      where: { status: 'ACTIVE' },
      include: {
        client: true,
        property: true,
        ledgerEntries: true,
      },
    });

    const aggregateData = plans.map(plan => {
      const totalPaid = plan.ledgerEntries
        .filter(e => e.type === 'PAYMENT')
        .reduce((sum, e) => sum + Number(e.amountGHS), 0);
      
      const balanceRemaining = Number(plan.totalAmount) - totalPaid;
      
      return {
        planId: plan.id,
        clientName: plan.client.name,
        propertyAddress: plan.property.address,
        type: plan.type,
        totalAmount: plan.totalAmount,
        equityAccrued: plan.equityAccrued,
        totalPaid,
        balanceRemaining,
      };
    });

    res.json({
      totalActivePlans: plans.length,
      data: aggregateData,
    });
  } catch (error) {
    console.error('Error fetching admin balances:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get overdue invoices across all clients
router.get('/invoices/overdue', async (req, res) => {
  try {
    const today = new Date();
    
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        isPaid: false,
        dueDate: { lt: today },
      },
      include: {
        paymentPlan: {
          include: { client: true }
        }
      },
      orderBy: { dueDate: 'asc' },
    });

    const formattedInvoices = overdueInvoices.map(invoice => ({
      invoiceId: invoice.id,
      clientName: invoice.paymentPlan.client.name,
      amountDue: invoice.amountDue,
      dueDate: invoice.dueDate,
      daysOverdue: Math.floor((today.getTime() - invoice.dueDate.getTime()) / (1000 * 3600 * 24)),
    }));

    res.json({
      totalOverdue: formattedInvoices.length,
      data: formattedInvoices,
    });
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manual entry tool for Bank Wires
router.post('/manual-entry', async (req, res) => {
  const { paymentPlanId, amountGHS, originalCurrency, originalAmount, reference, date } = req.body;

  try {
    const plan = await prisma.paymentPlan.findUnique({ where: { id: paymentPlanId } });

    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    await prisma.$transaction(async (tx) => {
      // 1. Create a successful payment record for the wire transfer
      const payment = await tx.payment.create({
        data: {
          provider: 'MANUAL_WIRE',
          providerTransactionId: reference || `wire_${Date.now()}`,
          status: 'SUCCESS',
          originalCurrency: originalCurrency || 'GHS',
          originalAmount: originalAmount || amountGHS,
          settledCurrency: 'GHS', // Base settlement currency, architecture allows this to be USD if needed later
          settledAmount: amountGHS,
        }
      });

      // 2. Add ledger entry
      await tx.ledgerEntry.create({
        data: {
          paymentPlanId: plan.id,
          type: 'PAYMENT',
          amountGHS: amountGHS,
          paymentId: payment.id,
          transactionDate: date ? new Date(date) : new Date(),
        }
      });

      // 3. Update equity (simplified, assuming PAY_TO_OWN for manual entry example)
      await tx.paymentPlan.update({
        where: { id: plan.id },
        data: { equityAccrued: { increment: amountGHS } }
      });
    });

    res.status(201).json({ message: 'Manual wire entry recorded successfully' });
  } catch (error) {
    console.error('Error recording manual entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download PDF receipt for a specific payment
router.get('/receipt/:paymentId', async (req, res) => {
  const { paymentId } = req.params;

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        ledgerEntries: {
          include: {
            paymentPlan: {
              include: { client: true, property: true }
            }
          }
        }
      }
    });

    if (!payment || payment.status !== 'SUCCESS') {
      return res.status(404).json({ error: 'Successful payment not found' });
    }

    const ledgerEntry = payment.ledgerEntries[0];
    if (!ledgerEntry) return res.status(400).json({ error: 'Ledger entry missing for payment' });

    const plan = ledgerEntry.paymentPlan;

    generateReceiptPDF(res, {
      clientName: plan.client.name,
      propertyAddress: plan.property.address || 'Unknown Address',
      paymentId: payment.id,
      amountGHS: Number(payment.settledAmount || payment.originalAmount),
      originalCurrency: payment.originalCurrency,
      originalAmount: Number(payment.originalAmount),
      date: payment.createdAt,
      planType: plan.type
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all properties
router.get('/properties', async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        interests: true,
        paymentPlans: true
      }
    });
    res.json(properties);
  } catch (error) {
    console.error('Error fetching admin properties:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get live transactions feed
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await prisma.ledgerEntry.findMany({
      orderBy: { transactionDate: 'desc' },
      take: 50,
      include: {
        paymentPlan: {
          include: {
            client: true,
            property: true
          }
        },
        payment: true
      }
    });
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching live transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all Property Interests (Applications)
router.get('/interests', async (req, res) => {
  try {
    const interests = await prisma.propertyInterest.findMany({
      include: {
        client: true,
        property: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(interests);
  } catch (error) {
    console.error('Error fetching admin interests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Application Status (Approve/Reject)
router.patch('/interests/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    if (!['APPROVED', 'REJECTED', 'PENDING', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const interest = await prisma.propertyInterest.update({
      where: { id },
      data: { status }
    });

    res.json(interest);
  } catch (error) {
    console.error('Error updating interest status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
