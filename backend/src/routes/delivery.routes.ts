// ── DELIVERY ROUTES ────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { auditLog } from '../utils/audit';
import { AppError } from '../utils/errors';

export const deliveryRouter = Router();
deliveryRouter.use(authenticate);

// ── DRIVER QUERY ROUTES ──────────────────────────────────────────────────────

// GET /api/delivery/driver-orders — driver's own deliveries
deliveryRouter.get('/driver-orders',
  authorize('driver'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.sub } });
    if (!driver) throw new AppError('Driver profile not found', 404);

    const deliveries = await prisma.delivery.findMany({
      where: { driverId: driver.id },
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
      orderBy: { createdAt: 'desc' },
    });

    const enriched = deliveries.map((d: any) => ({
      ...d,
      address:      d.deliveryAddress?.street
        ? [d.deliveryAddress.street, d.deliveryAddress.city].filter(Boolean).join(', ')
        : (typeof d.deliveryAddress === 'string' ? d.deliveryAddress : 'Address not available'),
      deliveryFee:  Number(d.order?.deliveryFee || 0),
    }));

    res.json(enriched);
  }),
);

// GET /api/delivery/jobs — backward compat
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

// GET /api/delivery/available — driver sees unassigned jobs
deliveryRouter.get('/available',
  authorize('driver'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');

    const available = await prisma.delivery.findMany({
      where: {
        driverId: null,
        order: { status: { in: ['ready_for_pickup', 'preparing', 'confirmed'] } },
      },
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

    const shaped = available.map((d: any) => ({
      id:           d.id,
      orderId:      d.orderId,
      pharmacyId:   d.order?.pharmacyId,
      pharmacyName: d.order?.pharmacy?.storeName || 'Pharmacy',
      address:      d.deliveryAddress?.street
        ? [d.deliveryAddress.street, d.deliveryAddress.city].filter(Boolean).join(', ')
        : 'Patient address',
      deliveryFee:  Number(d.order?.deliveryFee || 2.99),
      distance:     '~2',
      createdAt:    d.createdAt,
    }));

    res.json(shaped);
  }),
);

// ── DRIVER ACTION ROUTES ─────────────────────────────────────────────────────

// POST /api/delivery/:id/accept
deliveryRouter.post('/:id/accept',
  authorize('driver'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.sub } });
    if (!driver) throw new AppError('Driver profile not found', 404);
    if (!driver.isVerified) throw new AppError('Driver not verified', 403);

    const delivery = await prisma.delivery.findUnique({ where: { id: req.params.id } });
    if (!delivery) throw new AppError('Delivery not found', 404);
    if (delivery.driverId) throw new AppError('Delivery already assigned', 409);

    const updated = await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        driverId:         driver.id,
        status:           'assigned',
        assignedAt:       new Date(),
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

// Status update handler (POST /:id/update-status and PATCH /:id/status)
const handleStatusUpdate = asyncHandler(async (req: any, res: any) => {
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
  if (req.body.driverNotes)   data.driverNotes = req.body.driverNotes;

  await prisma.delivery.update({ where: { id: delivery.id }, data });

  if (status === 'delivered') {
    await prisma.order.update({
      where: { id: delivery.orderId },
      data:  { status: 'delivered' },
    });

    await prisma.driver.update({
      where: { id: driver.id },
      data:  { deliveryCount: { increment: 1 } },
    });

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

  // Note: order.status is not synced on pickup because the OrderStatus enum
  // may not include 'out_for_delivery'. The frontend reads delivery.status instead.

  res.json({ message: 'Delivery status updated', status });
});

deliveryRouter.post('/:id/update-status', authorize('driver'), handleStatusUpdate);
deliveryRouter.patch('/:id/status',       authorize('driver'), handleStatusUpdate);

// PATCH/POST /api/delivery/driver/online — toggle availability
const handleOnlineToggle = asyncHandler(async (req: any, res: any) => {
  const { prisma } = await import('../server');
  const driver = await prisma.driver.update({
    where: { userId: req.user!.sub },
    data:  { isOnline: req.body.isOnline },
  });
  res.json({ isOnline: driver.isOnline });
});

deliveryRouter.patch('/driver/online', authorize('driver'), handleOnlineToggle);
deliveryRouter.post('/driver/online',  authorize('driver'), handleOnlineToggle);

// ── DRIVER WALLET ──────────────────────────────────────────────────────────

deliveryRouter.get('/wallet',
  authorize('driver'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.sub } });
    if (!driver) throw new AppError('Driver not found', 404);

    const deliveredDeliveries = await prisma.delivery.findMany({
      where: { driverId: driver.id, status: 'delivered' },
      include: { order: { select: { deliveryFee: true } } },
      orderBy: { deliveredAt: 'desc' },
    });

    const totalEarned = deliveredDeliveries.reduce((sum, d) => sum + Number(d.order?.deliveryFee || 0), 0);

    const oneWeekAgo  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const thisWeek  = deliveredDeliveries
      .filter(d => d.deliveredAt && d.deliveredAt > oneWeekAgo)
      .reduce((sum, d) => sum + Number(d.order?.deliveryFee || 0), 0);

    const thisMonth = deliveredDeliveries
      .filter(d => d.deliveredAt && d.deliveredAt > oneMonthAgo)
      .reduce((sum, d) => sum + Number(d.order?.deliveryFee || 0), 0);

    const transactions = deliveredDeliveries.map(d => ({
      type:        'credit',
      amount:      Number(d.order?.deliveryFee || 0),
      description: `Delivery #${d.orderId.slice(-8).toUpperCase()}`,
      createdAt:   d.deliveredAt,
    }));

    res.json({
      balance:          totalEarned,
      totalEarned,
      thisWeek,
      thisMonth,
      totalDeliveries:  deliveredDeliveries.length,
      transactions,
    });
  }),
);

deliveryRouter.post('/withdraw',
  authorize('driver'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.sub } });
    if (!driver) throw new AppError('Driver not found', 404);

    const amount = Number(req.body.amount || 0);
    if (amount <= 0) throw new AppError('Invalid amount', 400);

    await prisma.notification.create({
      data: {
        userId: req.user!.sub,
        type:   'withdrawal_requested',
        title:  'Withdrawal Request Submitted',
        body:   `Your withdrawal request for £${amount.toFixed(2)} has been submitted. Admin will process within 2-3 business days.`,
        data:   {
          amount,
          bankDetails: req.body.bankDetails,
          driverId:    driver.id,
        },
      },
    });

    await auditLog({
      userId: req.user!.sub, action: 'created',
      resourceType: 'withdrawal',
      resourceId: driver.id,
    });

    res.status(201).json({
      message: 'Withdrawal request submitted. Admin will process within 2-3 business days.',
      amount,
    });
  }),
);

// ── DRIVER CHARGES (persists to DB) ────────────────────────────────────────

// GET /api/delivery/charges — load saved charge settings
deliveryRouter.get('/charges',
  authorize('driver'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');
    const driver = await prisma.driver.findUnique({
      where:  { userId: req.user!.sub },
      select: {
        baseCharge:    true,
        perMileRate:   true,
        serviceRadius: true,
        lat:           true,
        lng:           true,
      } as any,
    }) as any;
    if (!driver) throw new AppError('Driver not found', 404);

    res.json({
      baseCharge:    Number(driver.baseCharge ?? 3.50),
      perMileRate:   Number(driver.perMileRate ?? 1.20),
      serviceRadius: Number(driver.serviceRadius ?? 5.00),
      lat:           driver.lat ? Number(driver.lat) : null,
      lng:           driver.lng ? Number(driver.lng) : null,
    });
  }),
);

// POST /api/delivery/charges — save charge settings to DB
deliveryRouter.post('/charges',
  authorize('driver'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.sub } });
    if (!driver) throw new AppError('Driver not found', 404);

    const updates: any = {};

    if (req.body.baseCharge !== undefined) {
      const v = Number(req.body.baseCharge);
      if (isNaN(v) || v < 0) throw new AppError('Invalid baseCharge', 400);
      updates.baseCharge = v;
    }
    if (req.body.perMileRate !== undefined) {
      const v = Number(req.body.perMileRate);
      if (isNaN(v) || v < 0) throw new AppError('Invalid perMileRate', 400);
      updates.perMileRate = v;
    }
    if (req.body.serviceRadius !== undefined) {
      const v = Number(req.body.serviceRadius);
      if (isNaN(v) || v < 0.5) throw new AppError('Service radius must be at least 0.5 miles', 400);
      updates.serviceRadius = v;
    }
    if (req.body.lat !== undefined) {
      const v = Number(req.body.lat);
      if (isNaN(v) || v < -90 || v > 90) throw new AppError('Invalid latitude', 400);
      updates.lat = v;
    }
    if (req.body.lng !== undefined) {
      const v = Number(req.body.lng);
      if (isNaN(v) || v < -180 || v > 180) throw new AppError('Invalid longitude', 400);
      updates.lng = v;
    }

    const updated = await prisma.driver.update({
      where: { id: driver.id },
      data:  updates,
    }) as any;

    await auditLog({
      userId: req.user!.sub, action: 'updated',
      resourceType: 'driver',
      resourceId: driver.id,
      newValue: updates,
    });

    res.json({
      message:  'Charge settings saved',
      settings: {
        baseCharge:    Number(updated.baseCharge ?? 3.50),
        perMileRate:   Number(updated.perMileRate ?? 1.20),
        serviceRadius: Number(updated.serviceRadius ?? 5.00),
        lat:           updated.lat ? Number(updated.lat) : null,
        lng:           updated.lng ? Number(updated.lng) : null,
      },
    });
  }),
);

// ── PUBLIC TRACKING ────────────────────────────────────────────────────────

deliveryRouter.get('/track/:token', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const delivery = await prisma.delivery.findFirst({
    where: { trackingToken: req.params.token },
    select: {
      status:           true,
      estimatedMinutes: true,
      pickedUpAt:       true,
      deliveredAt:      true,
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

// ── ADMIN ROUTES ───────────────────────────────────────────────────────────
export const adminRouter = Router();
adminRouter.use(authenticate, authorize('admin'));

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

adminRouter.patch('/users/:id/verify', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const { status } = req.body;

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
