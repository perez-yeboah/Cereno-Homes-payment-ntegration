import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import paymentRoutes from './routes/payments';
import webhookRoutes from './routes/webhooks';
import planRoutes from './routes/plans';
import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import clientRoutes from './routes/client';
import propertyRoutes from './routes/properties';
import { authenticateToken } from './middleware/auth';
import { startInvoiceEngine } from './services/invoiceEngine';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

import path from 'path';

app.get('/', (req, res) => {
  res.json({ message: 'Cereno Homes API is running!' });
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const apiRouter = express.Router();
apiRouter.use('/auth', authRoutes);
apiRouter.use('/client', clientRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/webhooks', webhookRoutes);
apiRouter.use('/plans', planRoutes);
apiRouter.use('/properties', propertyRoutes);
apiRouter.use('/admin', authenticateToken, adminRoutes);

app.use('/api', apiRouter);

// Root level mounts for backwards compatibility
app.use('/auth', authRoutes);
app.use('/client', clientRoutes);
app.use('/payments', paymentRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/plans', planRoutes);
app.use('/properties', propertyRoutes);
app.use('/admin', authenticateToken, adminRoutes);

app.use((err: any, req: any, res: any, next: any) => {
  console.error("GLOBAL ERROR HANDLER:", err);
  let errorMsg = err?.message;
  if (!errorMsg) {
    try {
      errorMsg = typeof err === 'string' ? err : JSON.stringify(err);
    } catch(e) {
      errorMsg = 'Stringify failed';
    }
  }
  res.status(500).json({ error: errorMsg || 'Server error' });
});

// Start background cron jobs
startInvoiceEngine();

// Automatic DB currency migration: Ensure all properties and plans default to USD
import { PrismaClient } from '@prisma/client';
const dbStartup = new PrismaClient();
Promise.all([
  dbStartup.property.updateMany({
    where: { currency: 'GHS' },
    data: { currency: 'USD' }
  }),
  dbStartup.paymentPlan.updateMany({
    where: { currency: 'GHS' },
    data: { currency: 'USD' }
  })
]).then(([propRes, planRes]) => {
  if (propRes.count > 0 || planRes.count > 0) {
    console.log(`[Currency Migration] Normalized ${propRes.count} properties and ${planRes.count} plans to USD.`);
  }
}).catch((err) => {
  console.warn('[Currency Migration] Non-fatal migration check:', err?.message || err);
});

// Ensure info@cerenohomesghana.com is synced as an active admin user
dbStartup.adminUser.findFirst({ where: { email: 'info@cerenohomesghana.com' } }).then(async (exists) => {
  if (!exists) {
    const fallbackAdmin = await dbStartup.adminUser.findFirst({ where: { role: 'SUPERADMIN' } });
    if (fallbackAdmin) {
      await dbStartup.adminUser.create({
        data: {
          email: 'info@cerenohomesghana.com',
          password: fallbackAdmin.password,
          name: 'Cereno Homes Admin',
          role: 'SUPERADMIN'
        }
      });
      console.log('[Admin Sync] Synced info@cerenohomesghana.com as admin user.');
    }
  }
}).catch((err) => {
  console.warn('[Admin Sync] Non-fatal admin check:', err?.message || err);
});

app.listen(PORT, () => {
  console.log(`Cereno Homes Payment Integration Service running on port ${PORT}`);
});
