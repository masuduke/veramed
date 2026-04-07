import { logger } from './logger';

interface AuditEntry {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    const { prisma } = await import('../server');
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: entry.metadata,
      },
    });
  } catch (err) {
    logger.error('Audit log write failed:', err);
  }
}