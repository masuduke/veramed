import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

import { authRouter } from './routes/auth.routes';
import { patientRouter } from './routes/patient.routes';
import { doctorRouter } from './routes/doctor.routes';
import { pharmacyRouter } from './routes/pharmacy.routes';
import { orderRouter } from './routes/order.routes';
import { deliveryRouter } from './routes/delivery.routes';
import { paymentRouter } from './routes/payment.routes';
import { adminRouter } from './routes/admin.routes';
import { pricingRouter } from './routes/pricing.routes';
import { profileRouter } from './routes/profile.routes';

import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { logger } from './utils/logger';
import { asyncHandler } from './utils/async-handler';

// â”€â”€ Globals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

export const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
  },
});

// Prevent unhandled Redis errors from crashing the process
redis.on('error', (err) => {
  console.error('[Redis] error:', err?.message || err);
});
redis.on('reconnecting', () => {
  console.log('[Redis] reconnecting...');
});
redis.on('ready', () => {
  console.log('[Redis] ready');
});

// â”€â”€ App â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 4000;

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: true,
}));

// CORS â€” only allow known frontend origin
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// Global rate limiter
app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many auth attempts, please try again in 15 minutes.' },
});

// â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/health', (_req, res) => res.json({
  status: 'ok', version: '1.0.0', timestamp: new Date().toISOString(),
}));

app.use('/api/auth',      authLimiter, authRouter);
app.use('/api/patient',   patientRouter);
app.use('/api/doctor',    doctorRouter);
app.use('/api/pharmacy',  pharmacyRouter);
app.use('/api/orders',    orderRouter);
app.use('/api/delivery',  deliveryRouter);
app.use('/api/payment',   paymentRouter);


app.use('/api/admin',    adminRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api',         profileRouter);



// Temporary seed endpoint
app.post('/api/seed-admin', async (req: any, res: any) => {
  if (req.body.secret !== 'veramed-seed-2026') return res.status(403).json({ error: 'Forbidden' });
  try {
    const bcrypt = await import('bcryptjs');
    const accounts = [
      { name: 'VeraMed Admin', email: 'admin@veramed.health', password: 'Admin@123!', role: 'admin' },
      { name: 'Dr. Priya Patel', email: 'dr.patel@veramed.health', password: 'Doctor@123!', role: 'doctor' },
      { name: 'Boots Manchester', email: 'boots@veramed.health', password: 'Pharmacy@123!', role: 'pharmacy' },
      { name: 'Sarah Rahman', email: 'patient@veramed.health', password: 'Patient@123!', role: 'patient' },
      { name: 'James Wilson', email: 'driver@veramed.health', password: 'Driver@123!', role: 'driver' },
    ];
    for (const acc of accounts) {
      const hash = await bcrypt.hash(acc.password, 12);
      const user = await prisma.user.upsert({
        where: { email: acc.email },
        update: {},
        create: { name: acc.name, email: acc.email, passwordHash: hash, role: acc.role as any, status: 'verified' }
      });
      if (acc.role === 'doctor') await prisma.doctor.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, licenseNumber: 'GMC-123456', specialization: 'General Practice', available: true, verifiedAt: new Date() } });
      if (acc.role === 'pharmacy') await prisma.pharmacy.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, storeName: 'Boots Manchester', licenseNumber: 'PHARM-001', address: { street: '14 Market St', city: 'Manchester' } } });
      if (acc.role === 'patient') await prisma.patient.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, gender: 'female', bloodType: 'O+', allergies: ['Penicillin'], dateOfBirth: new Date('1990-05-15') } });
      if (acc.role === 'driver') await prisma.driver.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, isVerified: true, isOnline: true, licensePlate: 'MN72 ABC', vehicleInfo: { type: 'car', make: 'Toyota' } } });
    }
    res.json({ message: 'All accounts seeded', accounts: accounts.map(a => a.email) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
// Create country_pricing table
app.post('/api/create-tables', asyncHandler(async (req: any, res: any) => {
  if (req.body.secret !== 'veramed-setup-2026') return res.status(403).json({ error: 'Forbidden' });
  await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS country_pricing (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), country_code CHAR(2) UNIQUE NOT NULL, country_name VARCHAR(100) NOT NULL, currency_code CHAR(3) NOT NULL, currency_symbol VARCHAR(10) NOT NULL, patient_fee NUMERIC(10,2) NOT NULL, pharmacy_pct NUMERIC(5,2) NOT NULL, driver_pct NUMERIC(5,2) NOT NULL, doctor_fee NUMERIC(10,2) NOT NULL, free_km NUMERIC(5,1) NOT NULL DEFAULT 3, per_km_fee NUMERIC(10,2) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await prisma.$executeRawUnsafe('ALTER TABLE patients ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7)');
  await prisma.$executeRawUnsafe('ALTER TABLE patients ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7)');
  await prisma.$executeRawUnsafe('ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7)');
  await prisma.$executeRawUnsafe('ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7)');
  await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code CHAR(2)');
  res.json({ message: 'Tables created successfully' });
}));
// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use(errorHandler);

// â”€â”€ Boot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info('PostgreSQL connected');

    await redis.connect();
    logger.info('Redis connected');

    app.listen(PORT, () => {
      logger.info(`VeraMed API running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  await redis.disconnect();
  process.exit(0);
});

bootstrap();
