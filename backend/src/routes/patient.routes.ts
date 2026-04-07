import { Router } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { authenticate, authorize, requireVerified } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { analyzeReport, matchPrescriptionToPharmacies } from '../services/ai.service';
import { auditLog } from '../utils/audit';
import { AppError } from '../utils/errors';

export const patientRouter = Router();

patientRouter.use(authenticate, authorize('patient'));

// ── S3 Upload Config ───────────────────────────────────────────────
const s3 = new S3Client({ region: process.env.AWS_REGION });

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_S3_BUCKET!,
    metadata: (_req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const ext = file.originalname.split('.').pop();
      const key = `reports/${req.user!.sub}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      cb(null, key);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF and image files are allowed'));
  },
});

// POST /api/patient/upload-report
patientRouter.post('/upload-report',
  upload.single('report'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('No file uploaded', 400);

    const { prisma } = await import('../server');

    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.sub } });
    if (!patient) throw new AppError('Patient profile not found', 404);

    const s3File = req.file as Express.MulterS3.File;

    const report = await prisma.report.create({
      data: {
        patientId:     patient.id,
        fileUrl:       s3File.key,        // Store S3 key, NOT public URL
        fileName:      req.file.originalname,
        fileType:      req.file.mimetype,
        fileSizeBytes: req.file.size,
        description:   req.body.description || '',
        symptoms:      req.body.symptoms
          ? JSON.parse(req.body.symptoms)
          : [],
      },
    });

    // Trigger async AI analysis
    analyzeReport(report.id).catch((err) => {
      console.error('AI analysis failed:', err);
    });

    await auditLog({
      userId:       req.user!.sub,
      action:       'created',
      resourceType: 'report',
      resourceId:   report.id,
    });

    res.status(201).json({
      message: 'Report uploaded successfully. AI analysis in progress.',
      reportId: report.id,
    });
  }),
);

// GET /api/patient/reports
patientRouter.get('/reports', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const patient = await prisma.patient.findUnique({ where: { userId: req.user!.sub } });
  if (!patient) throw new AppError('Patient not found', 404);

  const reports = await prisma.report.findMany({
    where:   { patientId: patient.id },
    include: { aiAnalysis: { select: { aiSummary: true, confidenceScore: true, createdAt: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json(reports);
}));

// GET /api/patient/reports/:id/file — generate signed URL
patientRouter.get('/reports/:id/file', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const patient = await prisma.patient.findUnique({ where: { userId: req.user!.sub } });
  if (!patient) throw new AppError('Patient not found', 404);

  const report = await prisma.report.findFirst({
    where: { id: req.params.id, patientId: patient.id },
  });
  if (!report) throw new AppError('Report not found', 404);

  // Generate 15-minute signed URL
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key:    report.fileUrl,
  });
  const url = await getSignedUrl(s3, command, {
    expiresIn: Number(process.env.S3_URL_EXPIRY_SECONDS) || 900,
  });

  await auditLog({
    userId: req.user!.sub, action: 'viewed',
    resourceType: 'report', resourceId: report.id,
  });

  res.json({ url, expiresIn: 900 });
}));

// GET /api/patient/prescriptions
patientRouter.get('/prescriptions', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const patient = await prisma.patient.findUnique({ where: { userId: req.user!.sub } });
  if (!patient) throw new AppError('Patient not found', 404);

  const prescriptions = await prisma.prescription.findMany({
    where:   { patientId: patient.id },
    include: {
      doctor: {
        include: { user: { select: { name: true, avatarUrl: true } } },
      },
      // IMPORTANT: Only include AI analysis if approved — doctors control what patients see
      aiAnalysis: {
        select: {
          aiSummary: true,
          suggestedDiagnosis: true,
          confidenceScore: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Strip AI raw data — patients only see doctor-approved content
  const safeData = prescriptions.map((p) => ({
    ...p,
    // Only expose AI summary if prescription is approved
    aiAnalysis: p.status === 'approved' ? p.aiAnalysis : null,
  }));

  res.json(safeData);
}));

// GET /api/patient/prescriptions/:id/pharmacies
patientRouter.get('/prescriptions/:id/pharmacies', asyncHandler(async (req, res) => {
  const matches = await matchPrescriptionToPharmacies(req.params.id);
  res.json(matches);
}));

// GET /api/patient/orders
patientRouter.get('/orders', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const patient = await prisma.patient.findUnique({ where: { userId: req.user!.sub } });
  if (!patient) throw new AppError('Patient not found', 404);

  const orders = await prisma.order.findMany({
    where:   { patientId: patient.id },
    include: {
      items:    { include: { medication: { select: { name: true, strength: true } } } },
      delivery: { select: { status: true, estimatedMinutes: true, trackingToken: true } },
      payment:  { select: { status: true, amountPence: true, currency: true } },
      pharmacy: { select: { storeName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(orders);
}));
