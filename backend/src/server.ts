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

import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { logger } from './utils/logger';

// ── Globals ────────────────────────────────────────────────────────
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

export const redis = createClient({ url: process.env.REDIS_URL });

// ── App ────────────────────────────────────────────────────────────
const app = express();
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

// CORS — only allow known frontend origin
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
  max: 10,
  message: { error: 'Too many auth attempts, please try again in 15 minutes.' },
});

// ── Routes ─────────────────────────────────────────────────────────
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
app.use('/api/admin',     adminRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use(errorHandler);

// ── Boot ───────────────────────────────────────────────────────────
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
