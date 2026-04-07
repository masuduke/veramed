// ── PHARMACY ROUTES ────────────────────────────────────────────────
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
