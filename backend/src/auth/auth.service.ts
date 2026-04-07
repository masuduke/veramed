import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma, redis } from '../server';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { auditLog } from '../utils/audit';
import type { Request } from 'express';

// ── Types ──────────────────────────────────────────────────────────
export interface JwtPayload {
  sub: string;       // user id
  role: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ── Token Helpers ──────────────────────────────────────────────────
export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
    algorithm: 'HS256',
  });
}

export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Auth Service ───────────────────────────────────────────────────
export const AuthService = {

  async register(data: {
    name: string;
    email: string;
    password: string;
    role: string;
    phone?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('Email already registered', 409);

    const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(data.password, rounds);

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          role: data.role as any,
          phone: data.phone,
          status: 'pending',
        },
      });

      // Create role profile
      switch (data.role) {
        case 'patient':
          await tx.patient.create({ data: { userId: u.id } });
          break;
        case 'doctor':
          // Doctors require manual verification — set as pending
          await tx.doctor.create({
            data: {
              userId: u.id,
              licenseNumber: `PENDING-${u.id.slice(0, 8)}`,
              specialization: 'General',
            },
          });
          break;
        case 'pharmacy':
          await tx.pharmacy.create({
            data: {
              userId: u.id,
              storeName: data.name,
              licenseNumber: `PENDING-${u.id.slice(0, 8)}`,
              address: {},
            },
          });
          break;
        case 'driver':
          await tx.driver.create({ data: { userId: u.id } });
          break;
      }

      return u;
    });

    await auditLog({
      userId: user.id,
      action: 'created',
      resourceType: 'user',
      resourceId: user.id,
      newValue: { role: user.role, email: user.email },
    });

    logger.info(`New ${user.role} registered: ${user.email}`);
    return user;
  },

  async login(email: string, password: string, req: Request): Promise<TokenPair> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('Invalid credentials', 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('Invalid credentials', 401);

    if (user.status === 'suspended') throw new AppError('Account suspended. Contact support.', 403);

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      role: user.role,
      email: user.email,
    };

    const accessToken  = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const tokenHash    = hashToken(refreshToken);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId:    user.id,
        tokenHash,
        deviceInfo: req.headers['user-agent'] ? { userAgent: req.headers['user-agent'] } : undefined,
        ipAddress:  req.ip || null,
        expiresAt:  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Cache session in Redis (15min TTL matches access token)
    await redis.setEx(
      `session:${user.id}`,
      900,
      JSON.stringify({ role: user.role, email: user.email }),
    );

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await auditLog({
      userId: user.id,
      action: 'login',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  },

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const tokenHash = hashToken(rawRefreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppError('Refresh token revoked or expired', 401);
    }

    // Rotate: revoke old, issue new pair
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const newPayload = { sub: payload.sub, role: payload.role, email: payload.email };
    const accessToken  = signAccessToken(newPayload);
    const refreshToken = signRefreshToken(newPayload);

    await prisma.refreshToken.create({
      data: {
        userId:    payload.sub,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  },

  async logout(userId: string, rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    }
    await redis.del(`session:${userId}`);

    await auditLog({ userId, action: 'logout', resourceType: 'user', resourceId: userId });
  },

  async revokeAllSessions(userId: string) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await redis.del(`session:${userId}`);
  },
};
