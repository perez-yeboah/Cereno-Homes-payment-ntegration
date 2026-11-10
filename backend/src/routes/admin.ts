import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateReceiptPDF } from '../services/receiptEngine';
import { PaymentFactory } from '../services/paymentFactory';
import { sendInvoicePaymentLinkEmail } from '../services/emailService';

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
        currency: (plan.currency && plan.currency !== 'GHS') ? plan.currency : 'USD',
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
      currency: (invoice.paymentPlan.currency && invoice.paymentPlan.currency !== 'GHS') ? invoice.paymentPlan.currency : 'USD',
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

// Get all invoices with client, property, and plan details
router.get('/invoices', async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        paymentPlan: {
          include: {
            client: true,
            property: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const today = new Date();
    const formatted = invoices.map(inv => {
      const isOverdue = !inv.isPaid && new Date(inv.dueDate) < today;
      return {
        id: inv.id,
        paymentPlanId: inv.paymentPlanId,
        clientName: inv.paymentPlan.client.name,
        clientEmail: inv.paymentPlan.client.email,
        clientPhone: inv.paymentPlan.client.phone,
        propertyAddress: inv.paymentPlan.property.address || 'Unknown Address',
        amountDue: Number(inv.amountDue),
        currency: (inv.paymentPlan.currency && inv.paymentPlan.currency !== 'GHS') ? inv.paymentPlan.currency : 'USD',
        dueDate: inv.dueDate,
        isPaid: inv.isPaid,
        isOverdue,
        createdAt: inv.createdAt,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching admin invoices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate an invoice with a Stripe payment link for a client's plan
router.post('/invoices/generate-link', async (req, res) => {
  const { paymentPlanId, amount, dueDate, description, sendEmail: shouldSendEmail = true } = req.body;

  if (!paymentPlanId || !amount || !dueDate) {
    return res.status(400).json({ error: 'paymentPlanId, amount, and dueDate are required' });
  }

  try {
    const plan = await prisma.paymentPlan.findUnique({
      where: { id: paymentPlanId },
      include: { client: true, property: true }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Payment plan not found' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // 1. Create Invoice record
    const invoice = await prisma.invoice.create({
      data: {
        paymentPlanId: plan.id,
        amountDue: numAmount,
        dueDate: new Date(dueDate),
        isPaid: false,
      }
    });

    // 2. Create Pending Payment record
    const reference = `inv_${invoice.id}_${Date.now()}`;
    const currency = (plan.currency && plan.currency !== 'GHS') ? plan.currency : 'USD';

    const payment = await prisma.payment.create({
      data: {
        provider: 'STRIPE',
        providerTransactionId: reference,
        status: 'PENDING',
        originalCurrency: currency,
        originalAmount: numAmount,
      }
    });

    // 3. Initialize Stripe Checkout Session via StripeService
    const stripeProvider = PaymentFactory.getProvider('stripe');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const callbackUrl = `${frontendUrl}/payment/verify`;

    const invoiceDesc = description || `Cereno Homes - Invoice for ${plan.property.address || 'Property'}`;
    const paymentData = await stripeProvider.initializePayment(
      plan.client.email,
      numAmount,
      currency,
      reference,
      callbackUrl,
      {
        invoiceId: invoice.id,
        paymentPlanId: plan.id,
        description: invoiceDesc,
      }
    );

    // Update payment with actual session ID if available
    if (paymentData.sessionId) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { providerTransactionId: paymentData.sessionId }
      });
    }

    const paymentLink = paymentData.authorization_url || paymentData.checkoutUrl;

    // 4. Optionally email link to client
    if (shouldSendEmail && plan.client.email && paymentLink) {
      await sendInvoicePaymentLinkEmail(
        plan.client.email,
        plan.client.name,
        numAmount,
        currency,
        new Date(dueDate).toLocaleDateString(),
        paymentLink,
        invoiceDesc,
        plan.property.address || undefined
      );
    }

    res.status(201).json({
      message: 'Invoice and payment link generated successfully',
      invoice: {
        id: invoice.id,
        paymentPlanId: invoice.paymentPlanId,
        amountDue: Number(invoice.amountDue),
        dueDate: invoice.dueDate,
        isPaid: invoice.isPaid,
        clientName: plan.client.name,
        clientEmail: plan.client.email,
        propertyAddress: plan.property.address,
        currency,
      },
      paymentLink,
      currency,
      sessionId: paymentData.sessionId,
      reference,
    });
  } catch (error: any) {
    console.error('Error generating invoice payment link:', error);
    res.status(500).json({ error: error.message || 'Failed to generate invoice payment link' });
  }
});

// Generate or regenerate payment link for an existing invoice
router.post('/invoices/:id/payment-link', async (req, res) => {
  const { id } = req.params;
  const { sendEmail: shouldSendEmail = false, description } = req.body;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        paymentPlan: {
          include: { client: true, property: true }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.isPaid) {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    const plan = invoice.paymentPlan;
    const reference = `inv_${invoice.id}_${Date.now()}`;
    const currency = (plan.currency && plan.currency !== 'GHS') ? plan.currency : 'USD';
    const numAmount = Number(invoice.amountDue);

    if (numAmount > 999999.99) {
      return res.status(400).json({
        error: `Invoice amount (${numAmount.toLocaleString('en-US', { style: 'currency', currency })}) exceeds Stripe's maximum single transaction limit of $999,999.99. Please split this into milestone tranches or record as a Bank Wire.`
      });
    }

    const payment = await prisma.payment.create({
      data: {
        provider: 'STRIPE',
        providerTransactionId: reference,
        status: 'PENDING',
        originalCurrency: currency,
        originalAmount: numAmount,
      }
    });

    const stripeProvider = PaymentFactory.getProvider('stripe');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const callbackUrl = `${frontendUrl}/payment/verify`;
    const invoiceDesc = description || `Cereno Homes - Invoice for ${plan.property.address || 'Property'}`;

    const paymentData = await stripeProvider.initializePayment(
      plan.client.email,
      numAmount,
      currency,
      reference,
      callbackUrl,
      {
        invoiceId: invoice.id,
        paymentPlanId: plan.id,
        description: invoiceDesc,
      }
    );

    if (paymentData.sessionId) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { providerTransactionId: paymentData.sessionId }
      });
    }

    const paymentLink = paymentData.authorization_url || paymentData.checkoutUrl;

    if (shouldSendEmail && plan.client.email && paymentLink) {
      await sendInvoicePaymentLinkEmail(
        plan.client.email,
        plan.client.name,
        numAmount,
        currency,
        new Date(invoice.dueDate).toLocaleDateString(),
        paymentLink,
        invoiceDesc,
        plan.property.address || undefined
      );
    }

    res.json({
      message: 'Payment link generated successfully',
      paymentLink,
      sessionId: paymentData.sessionId,
      reference,
    });
  } catch (error: any) {
    console.error('Error creating payment link for invoice:', error);
    res.status(500).json({ error: error.message || 'Failed to generate payment link' });
  }
});

// Split an invoice into multiple equal milestone tranches
router.post('/invoices/:id/split', async (req, res) => {
  const { id } = req.params;
  const { tranches = 2 } = req.body; // default 2 tranches

  const numTranches = Math.max(2, Math.min(10, parseInt(tranches, 10) || 2));

  try {
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { paymentPlan: true }
    });

    if (!existingInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (existingInvoice.isPaid) {
      return res.status(400).json({ error: 'Cannot split an already paid invoice' });
    }

    const totalAmount = Number(existingInvoice.amountDue);
    const trancheBase = Math.floor((totalAmount / numTranches) * 100) / 100;
    const remainder = Math.round((totalAmount - trancheBase * numTranches) * 100) / 100;

    const baseDueDate = new Date(existingInvoice.dueDate || Date.now());

    // Perform inside transaction: delete original invoice, create new tranche invoices
    const newInvoices = await prisma.$transaction(async (tx) => {
      await tx.invoice.delete({ where: { id } });

      const created = [];
      for (let i = 0; i < numTranches; i++) {
        // Add remainder to the final tranche to ensure exact total match
        const amount = i === numTranches - 1 ? Number((trancheBase + remainder).toFixed(2)) : trancheBase;
        const dueDate = new Date(baseDueDate.getTime() + i * 30 * 24 * 60 * 60 * 1000); // 30 days apart

        const inv = await tx.invoice.create({
          data: {
            paymentPlanId: existingInvoice.paymentPlanId,
            amountDue: amount,
            dueDate,
            isPaid: false,
          }
        });
        created.push(inv);
      }
      return created;
    });

    res.json({
      message: `Invoice split into ${numTranches} tranches successfully`,
      invoices: newInvoices,
    });
  } catch (error: any) {
    console.error('Error splitting invoice:', error);
    res.status(500).json({ error: error.message || 'Failed to split invoice' });
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
          originalCurrency: (originalCurrency && originalCurrency !== 'GHS') ? originalCurrency : 'USD',
          originalAmount: originalAmount || amountGHS,
          settledCurrency: 'USD',
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
