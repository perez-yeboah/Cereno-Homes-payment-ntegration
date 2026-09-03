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
app.use(morgan('dev'));
app.use(express.json());

import path from 'path';

app.get('/', (req, res) => {
  res.json({ message: 'Cereno Homes API is running!' });
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/client', clientRoutes);
app.use('/payments', paymentRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/plans', planRoutes);
app.use('/properties', propertyRoutes);
app.use('/admin', authenticateToken, adminRoutes);

app.use((err: any, req: any, res: any, next: any) => {
  console.error("GLOBAL ERROR HANDLER:", err);
  if (err && typeof err === 'object') {
    console.error("ERROR JSON:", JSON.stringify(err, null, 2));
  }
  res.status(500).json({ error: err?.message || 'Server error' });
});

// Start background cron jobs
startInvoiceEngine();

app.listen(PORT, () => {
  console.log(`Cereno Homes Payment Integration Service running on port ${PORT}`);
});
