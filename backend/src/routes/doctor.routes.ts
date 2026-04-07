import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize, requireVerified } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { auditLog } from '../utils/audit';
import { AppError } from '../utils/errors';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export const doctorRouter = Router();
const s3 = new S3Client({ region: process.env.AWS_REGION });

doctorRouter.use(authenticate, authorize('doctor'), requireVerified);

// GET /api/doctor/pending-cases
doctorRouter.get('/pending-cases', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.sub } });
  if (!doctor) throw new AppError('Doctor profile not found', 404);

  const cases = await prisma.prescription.findMany({
    where: {
      doctorId: doctor.id,
      status: 'pending_review',
    },
    include: {
      patient: {
        include: { user: { select: { name: true, email: true, avatarUrl: true } } },
      },
      aiAnalysis: {
        include: {
          report: {
            select: {
              id: true, fileName: true, fileUrl: true,
              description: true, symptoms: true, createdAt: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' }, // oldest first
  });

  // Generate signed URLs for report files
  const casesWithUrls = await Promise.all(
    cases.map(async (c) => {
      const report = c.aiAnalysis?.report;
      let reportUrl: string | null = null;

      if (report?.fileUrl) {
        const cmd = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key:    report.fileUrl,
        });
        reportUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 });
      }

      return { ...c, aiAnalysis: { ...c.aiAnalysis, report: { ...report, signedUrl: reportUrl } } };
    }),
  );

  res.json(casesWithUrls);
}));

// GET /api/doctor/cases/stats
doctorRouter.get('/stats', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.sub } });
  if (!doctor) throw new AppError('Doctor profile not found', 404);

  const [pending, approved, rejected, total] = await Promise.all([
    prisma.prescription.count({ where: { doctorId: doctor.id, status: 'pending_review' } }),
    prisma.prescription.count({ where: { doctorId: doctor.id, status: 'approved' } }),
    prisma.prescription.count({ where: { doctorId: doctor.id, status: 'rejected' } }),
    prisma.prescription.count({ where: { doctorId: doctor.id } }),
  ]);

  res.json({ pending, approved, rejected, total });
}));

// POST /api/doctor/prescriptions/:id/approve
doctorRouter.post('/prescriptions/:id/approve',
  body('medications').isArray().notEmpty().withMessage('Medications list required'),
  body('notes').optional().isString(),
  body('validDays').optional().isInt({ min: 1, max: 365 }),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { prisma } = await import('../server');
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.sub } });
    if (!doctor) throw new AppError('Doctor profile not found', 404);

    const prescription = await prisma.prescription.findFirst({
      where: { id: req.params.id, doctorId: doctor.id },
    });

    if (!prescription) throw new AppError('Prescription not found', 404);
    if (prescription.status === 'approved') throw new AppError('Already approved', 409);

    const validUntil = req.body.validDays
      ? new Date(Date.now() + req.body.validDays * 86400000)
      : new Date(Date.now() + 30 * 86400000); // default 30 days

    const updated = await prisma.prescription.update({
      where: { id: prescription.id },
      data: {
        status:       'approved',
        medications:  req.body.medications,    // doctor may have modified
        doctorNotes:  req.body.notes || null,
        validUntil,
        approvedAt:   new Date(),
      },
    });

    // Mark AI analysis as reviewed
    if (prescription.aiAnalysisId) {
      await prisma.aiAnalysis.update({
        where: { id: prescription.aiAnalysisId },
        data: { reviewedByDoctor: true },
      });
    }

    // Notify patient
    await prisma.notification.create({
      data: {
        userId: (await prisma.patient.findUnique({
          where: { id: prescription.patientId },
          select: { userId: true },
        }))!.userId,
        type:  'prescription_approved',
        title: 'Prescription Approved',
        body:  'Your prescription has been reviewed and approved by your doctor. You can now order your medication.',
        data:  { prescriptionId: prescription.id },
      },
    });

    await auditLog({
      userId: req.user!.sub, action: 'approved',
      resourceType: 'prescription', resourceId: prescription.id,
      oldValue: { status: prescription.status },
      newValue: { status: 'approved', medications: req.body.medications },
    });

    res.json({ message: 'Prescription approved', prescription: updated });
  }),
);

// POST /api/doctor/prescriptions/:id/reject
doctorRouter.post('/prescriptions/:id/reject',
  body('reason').trim().isLength({ min: 10 }).withMessage('Rejection reason required (min 10 chars)'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { prisma } = await import('../server');
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.sub } });
    if (!doctor) throw new AppError('Doctor profile not found', 404);

    const prescription = await prisma.prescription.findFirst({
      where: { id: req.params.id, doctorId: doctor.id },
    });
    if (!prescription) throw new AppError('Prescription not found', 404);

    const updated = await prisma.prescription.update({
      where: { id: prescription.id },
      data: {
        status:          'rejected',
        rejectionReason: req.body.reason,
        doctorNotes:     req.body.notes || null,
      },
    });

    // Notify patient
    await prisma.notification.create({
      data: {
        userId: (await prisma.patient.findUnique({
          where: { id: prescription.patientId },
          select: { userId: true },
        }))!.userId,
        type:  'prescription_rejected',
        title: 'Prescription Rejected',
        body:  `Your prescription was not approved: ${req.body.reason}`,
        data:  { prescriptionId: prescription.id },
      },
    });

    await auditLog({
      userId: req.user!.sub, action: 'rejected',
      resourceType: 'prescription', resourceId: prescription.id,
      newValue: { reason: req.body.reason },
    });

    res.json({ message: 'Prescription rejected', prescription: updated });
  }),
);

// PATCH /api/doctor/availability
doctorRouter.patch('/availability', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const doctor = await prisma.doctor.update({
    where: { userId: req.user!.sub },
    data:  { available: req.body.available },
  });
  res.json({ available: doctor.available });
}));
