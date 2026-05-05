// ── PHARMACY ROUTES ────────────────────────────────────────────────────────────
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize, requireVerified } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { auditLog } from '../utils/audit';
import { AppError } from '../utils/errors';

export const pharmacyRouter = Router();
pharmacyRouter.use(authenticate, authorize('pharmacy'), requireVerified);

// GET /api/pharmacy/inventory
pharmacyRouter.get('/inventory', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: req.user!.sub } });
  if (!pharmacy) throw new AppError('Pharmacy not found', 404);

  const medications = await prisma.medication.findMany({
    where:   { pharmacyId: pharmacy.id },
    orderBy: { name: 'asc' },
  });

  const enriched = medications.map((m) => ({
    ...m,
    lowStock:      m.stock < 10,
    expiringSoon:  m.expiryDate ? new Date(m.expiryDate) < new Date(Date.now() + 30 * 86400000) : false,
    expired:       m.expiryDate ? new Date(m.expiryDate) < new Date() : false,
  }));

  res.json(enriched);
}));

// POST /api/pharmacy/medications
pharmacyRouter.post('/medications',
  body('name').trim().notEmpty(),
  body('price').isFloat({ min: 0.01 }),
  body('stock').isInt({ min: 0 }),
  body('requiresPrescription').isBoolean(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { prisma } = await import('../server');
    const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: req.user!.sub } });
    if (!pharmacy) throw new AppError('Pharmacy not found', 404);

    const medication = await prisma.medication.create({
      data: {
        pharmacyId:          pharmacy.id,
        name:                req.body.name,
        genericName:         req.body.genericName,
        brand:               req.body.brand,
        category:            req.body.category,
        dosageForm:          req.body.dosageForm,
        strength:            req.body.strength,
        price:               req.body.price,
        stock:               req.body.stock,
        requiresPrescription: req.body.requiresPrescription,
        barcode:             req.body.barcode,
        expiryDate:          req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
      },
    });

    await auditLog({
      userId: req.user!.sub, action: 'created',
      resourceType: 'medication', resourceId: medication.id,
    });

    res.status(201).json(medication);
  }),
);

// PATCH /api/pharmacy/medications/:id/stock
pharmacyRouter.patch('/medications/:id/stock',
  body('stock').isInt({ min: 0 }),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { prisma } = await import('../server');
    const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: req.user!.sub } });
    if (!pharmacy) throw new AppError('Pharmacy not found', 404);

    const medication = await prisma.medication.findFirst({
      where: { id: req.params.id, pharmacyId: pharmacy.id },
    });
    if (!medication) throw new AppError('Medication not found', 404);

    const updated = await prisma.medication.update({
      where: { id: medication.id },
      data:  { stock: req.body.stock },
    });

    res.json(updated);
  }),
);

// DELETE /api/pharmacy/medications/:id (soft: set stock to 0)
pharmacyRouter.delete('/medications/:id', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: req.user!.sub } });
  if (!pharmacy) throw new AppError('Pharmacy not found', 404);

  await prisma.medication.updateMany({
    where: { id: req.params.id, pharmacyId: pharmacy.id },
    data:  { stock: 0 },
  });

  res.json({ message: 'Medication delisted (stock set to 0)' });
}));

// GET /api/pharmacy/stats
pharmacyRouter.get('/stats', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: req.user!.sub } });
  if (!pharmacy) throw new AppError('Pharmacy not found', 404);

  const [totalMeds, lowStock, pendingOrders, completedOrders] = await Promise.all([
    prisma.medication.count({ where: { pharmacyId: pharmacy.id } }),
    prisma.medication.count({ where: { pharmacyId: pharmacy.id, stock: { lt: 10 } } }),
    prisma.order.count({ where: { pharmacyId: pharmacy.id, status: { in: ['pending', 'confirmed', 'preparing'] } } }),
    prisma.order.count({ where: { pharmacyId: pharmacy.id, status: 'delivered' } }),
  ]);

  const revenue = await prisma.order.aggregate({
    where:  { pharmacyId: pharmacy.id, status: 'delivered' },
    _sum:   { totalPrice: true },
  });

  res.json({ totalMeds, lowStock, pendingOrders, completedOrders, totalRevenue: revenue._sum.totalPrice || 0 });
}));

// ── NEW ROUTES ────────────────────────────────────────────────────────────────

// GET /api/pharmacy/orders — pharmacy sees all their orders
pharmacyRouter.get('/orders', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: req.user!.sub } });
  if (!pharmacy) throw new AppError('Pharmacy not found', 404);

  const orders = await prisma.order.findMany({
    where: { pharmacyId: pharmacy.id, status: { not: 'cancelled' } },
    include: {
      items:    { include: { medication: { select: { name: true, strength: true } } } },
      patient:  { include: { user: { select: { name: true } } } },
      delivery: { select: { status: true, driver: { include: { user: { select: { name: true } } } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(orders);
}));

// POST /api/pharmacy/orders/:id/ready — mark order ready for pickup, auto-assign driver
pharmacyRouter.post('/orders/:id/ready', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: req.user!.sub } });
  if (!pharmacy) throw new AppError('Pharmacy not found', 404);

  // Verify order belongs to this pharmacy
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, pharmacyId: pharmacy.id },
  });
  if (!order) throw new AppError('Order not found', 404);

  // Update order status
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: 'ready_for_pickup' },
  });

  // Auto-assign driver (online + verified, fewest deliveries first)
  const driver = await prisma.driver.findFirst({
    where: { isOnline: true, isVerified: true },
    orderBy: { deliveryCount: 'asc' },
  });

  if (driver) {
    await prisma.delivery.update({
      where: { orderId: order.id },
      data: {
        driverId:         driver.id,
        status:           'assigned',
        assignedAt:       new Date(),
        estimatedMinutes: 45,
      },
    });

    await prisma.notification.create({
      data: {
        userId: driver.userId,
        type:   'delivery_assigned',
        title:  'New Delivery Job',
        body:   'A delivery has been assigned to you. Please pick up from the pharmacy.',
        data:   { orderId: order.id },
      },
    });
  }

  await auditLog({
    userId: req.user!.sub, action: 'updated',
    resourceType: 'order', resourceId: order.id,
  });

  res.json({
    message: 'Order marked ready for pickup',
    status:  'ready_for_pickup',
    driverAssigned: !!driver,
    driverName: driver ? driver.id : null,
  });
}));

// GET /api/pharmacy/wallet — balance + transaction history
// Balance is computed from delivered orders. No actual wallet table needed.
pharmacyRouter.get('/wallet', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: req.user!.sub } });
  if (!pharmacy) throw new AppError('Pharmacy not found', 404);

  // Sum delivered orders as the pharmacy's earnings (in pounds)
  const deliveredOrders = await prisma.order.findMany({
    where: { pharmacyId: pharmacy.id, status: 'delivered' },
    select: { id: true, totalPrice: true, deliveryFee: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  // Pharmacy keeps subtotal (totalPrice - deliveryFee)
  const balance = deliveredOrders.reduce((sum, o) => {
    const earned = Number(o.totalPrice) - Number(o.deliveryFee || 0);
    return sum + earned;
  }, 0);

  const transactions = deliveredOrders.map((o) => ({
    type:        'credit',
    amount:      Number(o.totalPrice) - Number(o.deliveryFee || 0),
    description: `Order #${o.id.slice(-8).toUpperCase()} delivered`,
    createdAt:   o.updatedAt,
  }));

  res.json({ balance, transactions });
}));

// POST /api/pharmacy/withdraw — submit withdrawal request (admin will process manually)
pharmacyRouter.post('/withdraw',
  body('amount').isFloat({ min: 0.01 }),
  body('bankDetails').isObject(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { prisma } = await import('../server');
    const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: req.user!.sub } });
    if (!pharmacy) throw new AppError('Pharmacy not found', 404);

    // For now we just create a notification for admin and audit-log it.
    // A full implementation would have a WithdrawalRequest model.
    await prisma.notification.create({
      data: {
        userId: req.user!.sub,
        type:   'withdrawal_requested',
        title:  'Withdrawal Request Submitted',
        body:   `Your withdrawal request for £${Number(req.body.amount).toFixed(2)} has been submitted. Admin will process within 2-3 business days.`,
        data:   {
          amount:      Number(req.body.amount),
          bankDetails: req.body.bankDetails,
          pharmacyId:  pharmacy.id,
        },
      },
    });

    await auditLog({
      userId: req.user!.sub, action: 'created',
      resourceType: 'withdrawal',
      resourceId: pharmacy.id,
    });

    res.status(201).json({
      message: 'Withdrawal request submitted. Admin will process within 2-3 business days.',
      amount:  Number(req.body.amount),
    });
  }),
);
