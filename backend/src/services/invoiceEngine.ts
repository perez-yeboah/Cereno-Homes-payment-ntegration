import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { notifyUpcomingInvoice, notifyPenaltyApplied } from './notifications';

const prisma = new PrismaClient();

// This cron job will run every day at midnight (0 0 * * *)
export const startInvoiceEngine = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily invoice generation engine...');
    
    try {
      // Find all active plans
      const activePlans = await prisma.paymentPlan.findMany({
        where: { status: 'ACTIVE' },
        include: { client: true }
      });

      const today = new Date();
      
      for (const plan of activePlans) {
        const schedule = plan.scheduleDetails as any;
        
        if (schedule && schedule.nextDueDate) {
          const nextDueDate = new Date(schedule.nextDueDate);
          const diffDays = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
          
          if (diffDays <= 7 && diffDays >= 0) {
            let invoice = await prisma.invoice.findFirst({
              where: { paymentPlanId: plan.id, dueDate: nextDueDate }
            });

            if (!invoice) {
              invoice = await prisma.invoice.create({
                data: {
                  paymentPlanId: plan.id,
                  amountDue: schedule.installmentAmount,
                  dueDate: nextDueDate,
                  isPaid: false,
                }
              });
              console.log(`Generated invoice for plan ${plan.id}`);
            }

            // Reminders logic: send email/sms on exactly 7 days before and 1 day before
            if (diffDays === 7 || diffDays === 1) {
               await notifyUpcomingInvoice(
                 { name: plan.client.name, email: plan.client.email, phone: plan.client.phone },
                 { amountDue: Number(invoice.amountDue), dueDate: nextDueDate.toDateString(), daysLeft: diffDays }
               );
            }
          }
          
          // Overdue logic: Check for unpaid invoices past grace period
          if (diffDays < 0) {
            const unpaidInvoices = await prisma.invoice.findMany({
              where: { paymentPlanId: plan.id, isPaid: false, dueDate: { lt: today } }
            });

            for (const inv of unpaidInvoices) {
               const daysLate = Math.floor((today.getTime() - inv.dueDate.getTime()) / (1000 * 3600 * 24));
               const gracePeriod = schedule.gracePeriodDays || 5;

               // Apply penalty if exactly past the grace period (to only apply once)
               if (daysLate === gracePeriod + 1) {
                  const penaltyAmount = schedule.lateFeeAmount || 100; // default 100 GHS penalty

                  await prisma.$transaction(async (tx) => {
                     // Add penalty to invoice amount
                     const newAmountDue = Number(inv.amountDue) + penaltyAmount;
                     await tx.invoice.update({
                       where: { id: inv.id },
                       data: { amountDue: newAmountDue }
                     });

                     // Create penalty ledger entry for the debt
                     await tx.ledgerEntry.create({
                       data: {
                         paymentPlanId: plan.id,
                         type: 'PENALTY',
                         amountGHS: penaltyAmount,
                       }
                     });
                     
                     // Increase the total amount of the plan
                     await tx.paymentPlan.update({
                        where: { id: plan.id },
                        data: { totalAmount: { increment: penaltyAmount } }
                     });

                     await notifyPenaltyApplied(
                        { name: plan.client.name, email: plan.client.email, phone: plan.client.phone },
                        { penaltyAmount, totalDue: newAmountDue }
                     );
                  });
                  console.log(`Applied penalty of ${penaltyAmount} to plan ${plan.id}`);
               }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error running invoice engine:', error);
    }
  });
  
  console.log('Invoice engine scheduled.');
};
