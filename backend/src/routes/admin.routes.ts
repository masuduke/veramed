import { prisma } from '../server';
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const adminRouter = Router();
adminRouter.use(authenticate, authorize('admin'));

adminRouter.get('/stats', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const [patients, doctors, pharmacies, drivers, totalOrders, pendingRx, revenue] = await Promise.all([
    prisma.patient.count(),
    prisma.doctor.count(),
    prisma.pharmacy.count(),
    prisma.driver.count(),
    prisma.order.count(),
    prisma.prescription.count({ where: { status: 'pending_review' } }),
    prisma.payment.aggregate({ where: { status: 'succeeded' }, _sum: { amountPence: true } }),
  ]);
  res.json({ patients, doctors, pharmacies, drivers, totalOrders, pendingRx, totalRevenue: revenue._sum.amountPence || 0 });
}));

adminRouter.get('/analytics', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const [totalOrders, deliveredOrders, pendingOrders, totalPrescriptions, approvedPrescriptions] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'delivered' } }),
    prisma.order.count({ where: { status: { in: ['pending', 'confirmed', 'preparing'] } } }),
    prisma.prescription.count(),
    prisma.prescription.count({ where: { status: 'approved' } }),
  ]);
  res.json({ totalOrders, deliveredOrders, pendingOrders, totalPrescriptions, approvedPrescriptions });
}));

adminRouter.get('/users', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, lastLoginAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
}));

adminRouter.patch('/users/:id/verify', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const { status } = req.body;
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status } });
  if (status === 'verified' && user.role === 'doctor') {
    await prisma.doctor.update({ where: { userId: user.id }, data: { verifiedAt: new Date() } }).catch(() => {});
  }
  res.json({ message: 'User status updated', user });
}));

adminRouter.get('/wallet-requests', asyncHandler(async (req, res) => {
  res.json([]);
}));

adminRouter.patch('/wallet-requests/:id/approve', asyncHandler(async (req, res) => {
  res.json({ message: 'Approved' });
}));

adminRouter.get('/withdrawals', asyncHandler(async (req, res) => {
  res.json([]);
}));

adminRouter.patch('/withdrawals/:id/paid', asyncHandler(async (req, res) => {
  res.json({ message: 'Marked as paid' });
}));

adminRouter.get('/audit-logs', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(logs);
}));

adminRouter.get('/verifications/:id/docs', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  const doctor = await prisma.doctor.findFirst({
    where: { userId: req.params.id },
    select: { verificationDocs: true } as any,
  });
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  const docs = (doctor as any).verificationDocs || {};
  const signedUrls: Record<string, string> = {};
  for (const [key, s3Key] of Object.entries(docs)) {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET as string,
      Key: s3Key as string,
    });
    signedUrls[key] = await getSignedUrl(s3, command, { expiresIn: 900 });
  }
  res.json(signedUrls);
}));

adminRouter.get('/verifications', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const doctors = await prisma.user.findMany({
    where: { role: 'doctor', status: 'pending' },
    include: { doctor: { select: { licenseNumber: true, specialization: true, verificationDocs: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const drivers = await prisma.user.findMany({
    where: { role: 'driver', status: 'pending' },
    include: { driver: { select: { licensePlate: true, vehicleInfo: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ doctors, drivers });
}));

adminRouter.patch('/users/:id/reject-verification', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });
  await prisma.user.update({
    where: { id: req.params.id },
    data: { status: 'pending' } as any,
  });
  await prisma.doctor.update({
    where: { userId: req.params.id },
    data: { verificationRejectedReason: reason } as any,
  }).catch(() => {});
  res.json({ message: 'Verification rejected', reason });
}));

adminRouter.get('/unassigned-cases', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const cases = await prisma.prescription.findMany({
    where: { doctorId: null, status: 'pending_review' },
    include: {
      patient: { include: { user: { select: { name: true, email: true } } } },
      aiAnalysis: { select: { aiSummary: true } } as any,
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(cases);
}));

adminRouter.post('/unassigned-cases/:id/assign', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const { doctorId } = req.body;
  if (!doctorId) return res.status(400).json({ error: 'doctorId required' });
  await prisma.prescription.update({
    where: { id: req.params.id },
    data: { doctorId } as any,
  });
  res.json({ success: true });
}));

adminRouter.get('/platform-stats', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const [patients, doctors, pharmacies, drivers, totalOrders, deliveredOrders, pendingPrescriptions] = await Promise.all([
    prisma.patient.count(),
    prisma.doctor.count({ where: { user: { status: 'verified' } } }),
    prisma.pharmacy.count({ where: { user: { status: 'verified' } } }),
    prisma.driver.count({ where: { isOnline: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'delivered' } }),
    prisma.prescription.count({ where: { status: 'pending_review' } }),
  ]);
  res.json({ users: { patients, doctors, pharmacies, activeDrivers: drivers }, orders: { total: totalOrders, delivered: deliveredOrders }, prescriptions: { pending: pendingPrescriptions } });
}));
// POST /admin/users/:id/verify
adminRouter.post('/users/:id/verify', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  await prisma.user.update({ where: { id }, data: { status: 'active' } as any });
  res.json({ success: true, message: 'User verified' });
}));

// POST /admin/users/:id/suspend
adminRouter.post('/users/:id/suspend', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  await prisma.user.update({ where: { id }, data: { status: 'suspended' } as any });
  res.json({ success: true, message: 'User suspended' });
}));

