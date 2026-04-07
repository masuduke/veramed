// ── src/utils/errors.ts ────────────────────────────────────────────
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── src/utils/async-handler.ts ────────────────────────────────────
import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function asyncHandler(fn: RequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ── src/middleware/error.middleware.ts ────────────────────────────
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error, req: Request, res: Response, _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code:  err.code,
    });
  }

  // Prisma unique constraint violation
  if ((err as any).code === 'P2002') {
    return res.status(409).json({ error: 'A record with this value already exists.' });
  }

  // Prisma record not found
  if ((err as any).code === 'P2025') {
    return res.status(404).json({ error: 'Record not found.' });
  }

  // Multer file type error
  if (err.message.includes('Only PDF and image')) {
    return res.status(400).json({ error: err.message });
  }

  logger.error('Unhandled error:', {
    message:    err.message,
    stack:      err.stack,
    url:        req.url,
    method:     req.method,
    ip:         req.ip,
  });

  res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
}

// ── src/middleware/logger.middleware.ts ───────────────────────────
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`, {
      ip:     req.ip,
      userId: (req as any).user?.sub,
    });
  });
  next();
}

// ── src/utils/logger.ts ───────────────────────────────────────────
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.prettyPrint(),
  ),
  transports: [
    new winston.transports.Console(),
    ...(process.env.NODE_ENV === 'production'
      ? [new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
         new winston.transports.File({ filename: 'logs/combined.log' })]
      : []),
  ],
});

// ── src/utils/audit.ts ────────────────────────────────────────────
interface AuditEntry {
  userId?:      string;
  action:       string;
  resourceType: string;
  resourceId?:  string;
  oldValue?:    Record<string, any>;
  newValue?:    Record<string, any>;
  ipAddress?:   string;
  userAgent?:   string;
  metadata?:    Record<string, any>;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    const { prisma } = await import('../server');
    await prisma.auditLog.create({
      data: {
        userId:       entry.userId,
        action:       entry.action,
        resourceType: entry.resourceType,
        resourceId:   entry.resourceId,
        oldValue:     entry.oldValue,
        newValue:     entry.newValue,
        ipAddress:    entry.ipAddress,
        userAgent:    entry.userAgent,
        metadata:     entry.metadata,
      },
    });
  } catch (err) {
    // Audit failures should never crash the app — just log
    logger.error('Audit log write failed:', err);
  }
}
