// ── DELIVERY ROUTES ────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { auditLog } from '../utils/audit';
import { AppError } from '../utils/errors';

export const deliveryRouter = Router();
deliveryRouter.use(authenticate);

// GET /api/delivery/jobs — driver sees assigned deliveries
deliveryRouter.get('/jobs',
  authorize('driver'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.sub } });
    if (!driver) throw new AppError('Driver profile not found', 404);

    const deliveries = await prisma.delivery.findMany({
      where: {
        driverId: driver.id,
        status:   { in: ['assigned', 'picked_up', 'in_transit'] },
      },
      include: {
        order: {
          include: {
            patient:  { include: { user: { select: { name: true, phone: true } } } },
            pharmacy: { select: { storeName: true, address: true, phone: true } },
            items:    { include: { medication: { select: { name: true, strength: true } } } },
            payment:  { select: { status: true } },
          },
        },
      },
    });

    res.json(deliveries);
  }),
);

// GET /api/delivery/available — driver sees available (unassigned) jobs
deliveryRouter.get('/available',
  authorize('driver'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');
    const available = await prisma.delivery.findMany({
      where:   { status: 'unassigned' },
      include: {
        order: {
          include: {
            pharmacy: { select: { storeName: true, address: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take:    20,
    });
    res.json(available);
  }),
);

// POST /api/delivery/:id/accept — driver self-assigns
deliveryRouter.post('/:id/accept',
  authorize('driver'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.sub } });
    if (!driver) throw new AppError('Driver profile not found', 404);
    if (!driver.isVerified) throw new AppError('Driver not verified', 403);

    const delivery = await prisma.delivery.findUnique({ where: { id: req.params.id } });
    if (!delivery) throw new AppError('Delivery not found', 404);
    if (delivery.status !== 'unassigned') throw new AppError('Delivery already assigned', 409);

    const updated = await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        driverId:   driver.id,
        status:     'assigned',
        assignedAt: new Date(),
        estimatedMinutes: 40,
      },
    });

    await auditLog({
      userId: req.user!.sub, action: 'created',
      resourceType: 'delivery', resourceId: delivery.id,
      newValue: { driverId: driver.id, status: 'assigned' },
    });

    res.json({ message: 'Delivery accepted', delivery: updated });
  }),
);

// PATCH /api/delivery/:id/status — driver updates status
deliveryRouter.patch('/:id/status',
  authorize('driver'),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const allowed: Record<string, string> = {
      picked_up:  'picked_up',
      in_transit: 'in_transit',
      delivered:  'delivered',
      failed:     'failed',
    };

    if (!allowed[status]) throw new AppError('Invalid delivery status', 400);

    const { prisma } = await import('../server');
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.sub } });
    if (!driver) throw new AppError('Driver not found', 404);

    const delivery = await prisma.delivery.findFirst({
      where: { id: req.params.id, driverId: driver.id },
    });
    if (!delivery) throw new AppError('Delivery not found', 404);

    const data: any = { status };
    if (status === 'picked_up') data.pickedUpAt  = new Date();
    if (status === 'delivered') data.deliveredAt = new Date();
    if (req.body.driverNotes)  data.driverNotes  = req.body.driverNotes;

    const updated = await prisma.delivery.update({ where: { id: delivery.id }, data });

    // Sync order status
    if (status === 'delivered') {
      await prisma.order.update({
        where: { id: delivery.orderId },
        data:  { status: 'delivered' },
      });

      // Increment driver delivery count
      await prisma.driver.update({
        where: { id: driver.id },
        data:  { deliveryCount: { increment: 1 } },
      });

      // Notify patient
      const order = await prisma.order.findUnique({
        where: { id: delivery.orderId },
        include: { patient: { select: { userId: true } } },
      });
      if (order) {
        await prisma.notification.create({
          data: {
            userId: order.patient.userId,
            type:   'order_delivered',
            title:  'Order Delivered',
            body:   'Your medication has been delivered. Please check your door.',
            data:   { orderId: order.id },
          },
        });
      }
    }

    res.json({ message: 'Delivery status updated', status });
  }),
);

// PATCH /api/delivery/driver/online — toggle availability
deliveryRouter.patch('/driver/online',
  authorize('driver'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');
    const driver = await prisma.driver.update({
      where: { userId: req.user!.sub },
      data:  { isOnline: req.body.isOnline },
    });
    res.json({ isOnline: driver.isOnline });
  }),
);

// GET /api/delivery/track/:token — public tracking (no auth)
deliveryRouter.get('/track/:token', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const delivery = await prisma.delivery.findFirst({
    where: { trackingToken: req.params.token },
    select: {
      status:          true,
      estimatedMinutes: true,
      pickedUpAt:      true,
      deliveredAt:     true,
      order: {
        select: {
          status: true,
          pharmacy: { select: { storeName: true } },
        },
      },
    },
  });

  if (!delivery) return res.status(404).json({ error: 'Tracking information not found' });
  res.json(delivery);
}));

// ── ADMIN ROUTES ───────────────────────────────────────────────────
export const adminRouter = Router();
adminRouter.use(authenticate, authorize('admin'));

// GET /api/admin/users — list all users with filters
adminRouter.get('/users', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const { role, status, page = '1', limit = '20' } = req.query as Record<string, string>;

  const where: any = {};
  if (role)   where.role   = role;
  if (status) where.status = status;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true,
        status: true, createdAt: true, lastLoginAt: true,
        doctor:   { select: { licenseNumber: true, specialization: true } },
        pharmacy: { select: { storeName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:  (Number(page) - 1) * Number(limit),
      take:  Number(limit),
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ users, total, page: Number(page), limit: Number(limit) });
}));

// PATCH /api/admin/users/:id/verify — verify doctor or pharmacy
adminRouter.patch('/users/:id/verify', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const { status } = req.body; // 'verified' | 'rejected' | 'suspended'

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data:  { status },
  });

  if (status === 'verified' && user.role === 'doctor') {
    await prisma.doctor.update({
      where: { userId: user.id },
      data:  { verifiedAt: new Date() },
    });
  }

  await auditLog({
    userId: req.user!.sub, action: status === 'verified' ? 'approved' : 'rejected',
    resourceType: 'user', resourceId: user.id,
    newValue: { status },
  });

  // Notify the user
  await prisma.notification.create({
    data: {
      userId: user.id,
      type:   'account_verified',
      title:  status === 'verified' ? 'Account Verified' : 'Account Update',
      body:   status === 'verified'
        ? 'Your account has been verified. You can now use all platform features.'
        : `Your account status has been updated to: ${status}.`,
    },
  });

  res.json({ message: `User status updated to ${status}`, user });
}));

// GET /api/admin/audit-logs
adminRouter.get('/audit-logs', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const { page = '1', limit = '50', resourceType } = req.query as Record<string, string>;

  const where: any = {};
  if (resourceType) where.resourceType = resourceType;

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    skip:    (Number(page) - 1) * Number(limit),
    take:    Number(limit),
  });

  res.json(logs);
}));

// GET /api/admin/platform-stats
adminRouter.get('/platform-stats', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');

  const [patients, doctors, pharmacies, drivers,
         totalOrders, deliveredOrders, pendingPrescriptions, revenue] = await Promise.all([
    prisma.patient.count(),
    prisma.doctor.count({ where: { user: { status: 'verified' } } }),
    prisma.pharmacy.count({ where: { user: { status: 'verified' } } }),
    prisma.driver.count({ where: { isOnline: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'delivered' } }),
    prisma.prescription.count({ where: { status: 'pending_review' } }),
    prisma.payment.aggregate({ where: { status: 'succeeded' }, _sum: { amountPence: true } }),
  ]);

  res.json({
    users:     { patients, doctors, pharmacies, activeDrivers: drivers },
    orders:    { total: totalOrders, delivered: deliveredOrders },
    prescriptions: { pending: pendingPrescriptions },
    revenue:   { totalPence: revenue._sum.amountPence || 0 },
  });
}));
