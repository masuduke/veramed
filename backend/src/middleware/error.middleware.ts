import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error, req: Request, res: Response, _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  if ((err as any).code === 'P2002') {
    return res.status(409).json({ error: 'A record with this value already exists.' });
  }

  if ((err as any).code === 'P2025') {
    return res.status(404).json({ error: 'Record not found.' });
  }

  if (err.message.includes('Only PDF and image')) {
    return res.status(400).json({ error: err.message });
  }

  logger.error('Unhandled error:', { message: err.message, stack: err.stack, url: req.url });

  res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
}