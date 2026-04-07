import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type JwtPayload } from '../auth/auth.service';
import { redis } from '../server';
import { AppError } from '../utils/errors';

// Extend Express Request with user context
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ── Authenticate (verify JWT) ──────────────────────────────────────
export async function authenticate(
  req: Request, res: Response, next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Missing authorization token', 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    // Check if session is still alive in Redis (handles forced logout)
    const session = await redis.get(`session:${payload.sub}`);
    if (!session) {
      throw new AppError('Session expired. Please log in again.', 401);
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Invalid or expired token', 401));
  }
}

// ── Authorize (RBAC role check) ────────────────────────────────────
export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(`Access denied. Required role: ${roles.join(' or ')}`, 403));
    }
    next();
  };
}

// ── Self-only guard (user can only access their own resources) ─────
export function selfOrAdmin(paramKey = 'id') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));
    const resourceId = req.params[paramKey];
    if (req.user.sub !== resourceId && req.user.role !== 'admin') {
      return next(new AppError('Access denied to this resource', 403));
    }
    next();
  };
}

// ── Verified user guard ────────────────────────────────────────────
// Doctors and pharmacies must be manually verified before acting
export async function requireVerified(
  req: Request, _res: Response, next: NextFunction,
) {
  if (!req.user) return next(new AppError('Not authenticated', 401));

  // Patients and drivers don't need manual verification
  if (['patient', 'driver', 'admin'].includes(req.user.role)) return next();

  const { prisma } = await import('../server');
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { status: true },
  });

  if (user?.status !== 'verified') {
    return next(new AppError(
      'Account pending verification. Please complete your profile and await admin approval.',
      403,
    ));
  }

  next();
}
