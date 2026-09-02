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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);

// Start background cron jobs
startInvoiceEngine();

app.listen(PORT, () => {
  console.log(`Cereno Homes Payment Integration Service running on port ${PORT}`);
});
