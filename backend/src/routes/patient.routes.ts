import { Router } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { authenticate, authorize, requireVerified } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { analyzeReport } from '../services/ai.service';
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
    // File is optional - patients can submit symptoms only

    const { prisma } = await import('../server');

    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.sub } });
    if (!patient) throw new AppError('Patient profile not found', 404);

    const s3File = req.file as any;

    const report = await prisma.report.create({
      data: {
        patientId:     patient.id,
        fileUrl:       s3File?.key || '',
        fileName:      req.file?.originalname || '',
        fileType:      req.file?.mimetype || '',
        fileSizeBytes: req.file?.size || 0,
        description:   req.body.description || '',
        symptoms:      req.body.symptoms
          ? JSON.parse(req.body.symptoms)
          : [],
      },
    });

    // Calculate patient context
    const dob = (patient as any).dateOfBirth;
    const ageText = dob ? 'Patient age: ' + Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365)) + ' years old.' : '';
    const gender = (patient as any).gender ? 'Gender: ' + (patient as any).gender + '.' : '';
    const knownAllergies = (patient as any).allergies?.length > 0 ? 'Known allergies: ' + (patient as any).allergies.join(', ') + '.' : '';
    const patientContext = [ageText, gender, knownAllergies].filter(Boolean).join(' ');

    // Trigger AI analysis and save results
    analyzeReport(report.description || '', report.symptoms || [], undefined, patientContext).then(async (analysis) => {
      const { prisma: db } = await import('../server');
      try {
        const aiAnalysis = await (db as any).aiAnalysis.create({
          data: {
            reportId: report.id,
            modelVersion: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
            aiSummary: analysis.aiSummary,
            suggestedDiagnosis: analysis.suggestedDiagnosis,
            suggestedMedication: analysis.suggestedMedication as any,
            confidenceScore: analysis.confidenceScore,
            warnings: analysis.warnings,
            urgencyLevel: analysis.urgencyLevel,
            recommendedTests: analysis.recommendedTests as any,
            lifestyleAdvice: analysis.lifestyleAdvice,
            dietaryAdvice: analysis.dietaryAdvice,
            whenToSeekEmergency: analysis.whenToSeekEmergency,
          },
        });
        // Find longest idle doctor for primary specialty
        const primarySpecialty = analysis.requiredSpecialties[0] || 'general_medicine';
        // Find longest idle doctor - check both formats of specialty name
        const specialtyVariants: Record<string, string[]> = {
          general_medicine: ['general_medicine', 'General Practice', 'General Medicine', 'general medicine', 'GP'],
          cardiology: ['cardiology', 'Cardiology'],
          gynaecology: ['gynaecology', 'Gynaecology'],
          dermatology: ['dermatology', 'Dermatology'],
          neurology: ['neurology', 'Neurology'],
          paediatrics: ['paediatrics', 'Paediatrics'],
          orthopaedics: ['orthopaedics', 'Orthopaedics'],
          psychiatry: ['psychiatry', 'Psychiatry'],
          oncology: ['oncology', 'Oncology'],
          emergency_medicine: ['emergency_medicine', 'Emergency Medicine'],
          endocrinology: ['endocrinology', 'Endocrinology'],
          gastroenterology: ['gastroenterology', 'Gastroenterology'],
          pulmonology: ['pulmonology', 'Pulmonology'],
          nephrology: ['nephrology', 'Nephrology'],
          rheumatology: ['rheumatology', 'Rheumatology'],
        };
        const variants = specialtyVariants[primarySpecialty] || [primarySpecialty];
        const assignedDoctor = await db.doctor.findFirst({
          where: {
            specialization: { in: variants },
            available: true,
            user: { status: 'verified' },
          },
          orderBy: { lastCaseAssignedAt: 'asc' },
        });
        const prescription = await db.prescription.create({
          data: {
            patientId: patient.id,
            doctorId: assignedDoctor?.id || undefined,
            status: 'pending_review',
            medications: analysis.suggestedMedication as any,
            aiAnalysisId: aiAnalysis.id,
          } as any,
        });
        // Fallback 1: if no specialty match, assign to any available verified doctor
        let finalDoctor = assignedDoctor;
        if (!finalDoctor) {
          finalDoctor = await db.doctor.findFirst({
            where: { available: true, user: { status: 'verified' } },
            orderBy: { lastCaseAssignedAt: 'asc' },
          });
          if (finalDoctor) console.log('No specialty match - assigned to fallback doctor: ' + finalDoctor.id);
        }

        // Fallback 2: if still no doctor, log as unassigned for admin
        if (!finalDoctor) {
          console.log('WARNING: No available doctor for prescription ' + prescription.id + ' - needs admin assignment');
        } else {
          // Update prescription with assigned doctor
          await db.prescription.update({
            where: { id: prescription.id },
            data: { doctorId: finalDoctor.id } as any,
          });
          await db.doctor.update({
            where: { id: finalDoctor.id },
            data: { lastCaseAssignedAt: new Date() } as any,
          });
        }
        for (const specialty of analysis.requiredSpecialties) {
          const specialtyMeds = analysis.medicationsBySpecialty[specialty] || [];
          await (db as any).prescriptionApproval.create({
            data: {
              prescriptionId: prescription.id,
              specialty,
              status: 'pending',
              medications: specialtyMeds as any,
            },
          });
        }
        await db.report.update({ where: { id: report.id }, data: { processed: true } as any });
        console.log('AI analysis saved for report ' + report.id);
      } catch (saveErr) {
        console.error('Failed to save AI analysis:', saveErr);
      }
    }).catch((err) => {
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

// GET /api/patient/test-requests
patientRouter.get('/test-requests', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const patient = await prisma.patient.findUnique({ where: { userId: req.user!.sub } });
  if (!patient) throw new AppError('Patient not found', 404);
  const prescriptions = await prisma.prescription.findMany({
    where: { patientId: patient.id },
    select: { id: true },
  });
  const prescriptionIds = prescriptions.map((p: any) => p.id);
  const testRequests = await (prisma as any).testRequest.findMany({
    where: { prescriptionId: { in: prescriptionIds } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(testRequests);
}));

// POST /api/patient/test-requests/:id/upload
patientRouter.post('/test-requests/:id/upload',
  upload.array('report', 10),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');
    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.sub } });
    if (!patient) throw new AppError('Patient not found', 404);

    const testRequest = await (prisma as any).testRequest.findUnique({
      where: { id: req.params.id },
      include: { prescription: true },
    });
    if (!testRequest) throw new AppError('Test request not found', 404);
    if (testRequest.prescription.patientId !== patient.id) throw new AppError('Access denied', 403);

    const files = (req.files || []) as any[];
    const firstFile = files[0];
    const report = await prisma.report.create({
      data: {
        patientId: patient.id,
        fileUrl: firstFile?.key || '',
        fileName: firstFile?.originalname || 'Test Results',
        fileType: firstFile?.mimetype || '',
        fileSizeBytes: firstFile?.size || 0,
        description: req.body.description || ('Test results upload - ' + files.length + ' file(s)'),
        symptoms: [],
      },
    });

    await (prisma as any).testRequest.update({
      where: { id: req.params.id },
      data: { status: 'uploaded', patientUploadedAt: new Date() },
    });

    // Update prescription and approval status back to pending so same doctor sees it
    const { prisma: db2 } = await import('../server');
    await db2.prescription.update({
      where: { id: testRequest.prescriptionId },
      data: { status: 'pending_review' } as any,
    });
    // Reset prescription approvals to pending so doctor sees case again
    await (db2 as any).prescriptionApproval.updateMany({
      where: {
        prescriptionId: testRequest.prescriptionId,
        doctorId: testRequest.doctorId,
      },
      data: { status: 'pending', decidedAt: null },
    });

    console.log('Test results uploaded for prescription ' + testRequest.prescriptionId + ' - doctor notified');

    // Re-trigger AI analysis with test results
    const dob = (patient as any).dateOfBirth;
    const ageText = dob ? 'Patient age: ' + Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365)) + ' years old.' : '';
    const patientContext = ageText;
    const testContext = 'These are follow-up test results. Original prescription ID: ' + testRequest.prescriptionId;

    analyzeReport(req.body.description || 'Test results', [], undefined, patientContext + ' ' + testContext).then(async (analysis) => {
      const { prisma: db } = await import('../server');
      try {
        const aiAnalysis = await (db as any).aiAnalysis.create({
          data: {
            reportId: report.id,
            modelVersion: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
            aiSummary: analysis.aiSummary,
            suggestedDiagnosis: analysis.suggestedDiagnosis,
            suggestedMedication: analysis.suggestedMedication as any,
            confidenceScore: analysis.confidenceScore,
            warnings: analysis.warnings,
            urgencyLevel: analysis.urgencyLevel,
            recommendedTests: analysis.recommendedTests as any,
            lifestyleAdvice: analysis.lifestyleAdvice,
            dietaryAdvice: analysis.dietaryAdvice,
            whenToSeekEmergency: analysis.whenToSeekEmergency,
          },
        });
        await db.report.update({ where: { id: report.id }, data: { processed: true } as any });
        console.log('Test result AI analysis saved for report ' + report.id);
      } catch (saveErr) {
        console.error('Failed to save test result AI analysis:', saveErr);
      }
    }).catch(console.error);

    res.json({ success: true, reportId: report.id, message: 'Test results uploaded successfully' });
  })
);


// GET /api/patient/prescriptions/:id/pharmacy-options
patientRouter.get('/prescriptions/:id/pharmacy-options', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const patient = await prisma.patient.findUnique({ where: { userId: req.user!.sub } });
  if (!patient) throw new AppError('Patient not found', 404);

  const prescription = await prisma.prescription.findFirst({
    where: { id: req.params.id, patientId: patient.id },
  });
  if (!prescription) throw new AppError('Prescription not found', 404);

  const patientLat = (patient as any).lat;
  const patientLng = (patient as any).lng;
  const patientCountry = (patient as any).address?.country || null;

  const pharmacies = await prisma.pharmacy.findMany({
    where: { user: { status: 'verified' }, acceptsOrders: true },
    include: {
      user: { select: { name: true, status: true } },
      medications: { select: { id: true, name: true, genericName: true, stock: true, price: true } },
    },
  });

  const prescribedMeds = (prescription.medications as any[]) || [];

  const options = pharmacies.map((pharmacy: any) => {
    const pharmLat = (pharmacy as any).lat;
    const pharmLng = (pharmacy as any).lng;
    let distanceMiles = null;
    if (patientLat && patientLng && pharmLat && pharmLng) {
      const R = 3959;
      const dLat = (pharmLat - patientLat) * Math.PI / 180;
      const dLon = (pharmLng - patientLng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(patientLat * Math.PI / 180) * Math.cos(pharmLat * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      distanceMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    const availableMeds = prescribedMeds.map((med: any) => {
      const match = pharmacy.medications.find((m: any) =>
        m.name?.toLowerCase().includes(med.name?.toLowerCase() || '') ||
        (m.genericName && med.genericName && m.genericName.toLowerCase() === med.genericName?.toLowerCase())
      );
      return {
        name: med.name,
        genericName: med.genericName,
        available: !!match && match.stock > 0,
        price: match ? match.price : null,
        stock: match ? match.stock : null,
        medicationId: match ? match.id : null,
      };
    });

    const availableCount = availableMeds.filter((m: any) => m.available).length;
    const coveragePercent = prescribedMeds.length > 0 ? Math.round((availableCount / prescribedMeds.length) * 100) : 0;
    const withinRange = distanceMiles ? distanceMiles <= 10 : true;

    // Country filter
    const pharmCountry = (pharmacy.address as any)?.country || null;
    const sameCountry = !patientCountry || !pharmCountry || patientCountry === pharmCountry;

    return {
      id: pharmacy.id,
      storeName: pharmacy.storeName,
      address: pharmacy.address,
      distanceMiles: distanceMiles ? Math.round(distanceMiles * 10) / 10 : null,
      availableMeds,
      availableCount,
      totalMeds: prescribedMeds.length,
      coveragePercent,
      withinRange,
      sameCountry,
    };
  }).filter((o: any) => o.withinRange && o.sameCountry)
    .sort((a: any, b: any) => {
      if (a.distanceMiles !== null && b.distanceMiles !== null) return a.distanceMiles - b.distanceMiles;
      return b.coveragePercent - a.coveragePercent;
    });

  // Format response to match frontend expectations
  const foundSomewhere = prescribedMeds.filter((med: any) =>
    options.some((o: any) => o.availableMeds.find((m: any) => m.name === med.name && m.available))
  ).length;

  res.json({
    pharmacyOptions: options.map((o: any) => {
      const foundMeds = o.availableMeds
        .filter((m: any) => m.available)
        .map((m: any) => ({
          id: m.medicationId,
          name: m.name,
          genericName: m.genericName,
          price: Number(m.price) || 0,
          stock: m.stock,
        }));

      const missingMeds = o.availableMeds
        .filter((m: any) => !m.available)
        .map((m: any) => ({ name: m.name }));

      const totalPrice = foundMeds.reduce(
        (sum: number, m: any) => sum + (Number(m.price) || 0),
        0
      );

      const locationStr = o.address
        ? [o.address.street, o.address.city].filter(Boolean).join(', ')
        : null;

      return {
        pharmacyId: o.id,
        pharmacyName: o.storeName,
        address: o.address,
        location: locationStr,
        distanceMiles: o.distanceMiles,
        coverage: o.coveragePercent,
        totalPrice,
        foundMeds,
        missingMeds,
      };
    }),
    summary: {
      totalRequested: prescribedMeds.length,
      foundSomewhere,
      notFound: prescribedMeds.length - foundSomewhere,
    },
    notFoundAnywhere: prescribedMeds
      .filter((med: any) =>
        !options.some((o: any) =>
          o.availableMeds.find((m: any) => m.name === med.name && m.available)
        )
      )
      .map((m: any) => ({ name: m.name })),
    splitOption: null,
    prescriptionId: req.params.id,
  });
}));

// GET /api/patient/prescriptions/:id/pharmacies
patientRouter.get('/prescriptions/:id/pharmacies', asyncHandler(async (req, res) => {
  res.json([]);
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
