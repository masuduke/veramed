import { Router } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { AppError } from '../utils/errors';
import { auditLog } from '../utils/audit';
import { prisma } from '../server';

const router = Router();
router.use(authenticate, authorize('doctor'));

export const SPECIALTIES = [
  { value: 'general_medicine',   label: 'General Medicine / GP' },
  { value: 'cardiology',         label: 'Cardiology' },
  { value: 'gynaecology',        label: 'Gynaecology' },
  { value: 'dermatology',        label: 'Dermatology' },
  { value: 'neurology',          label: 'Neurology' },
  { value: 'paediatrics',        label: 'Paediatrics' },
  { value: 'orthopaedics',       label: 'Orthopaedics' },
  { value: 'psychiatry',         label: 'Psychiatry' },
  { value: 'oncology',           label: 'Oncology' },
  { value: 'emergency_medicine', label: 'Emergency Medicine' },
  { value: 'endocrinology',      label: 'Endocrinology / Diabetes' },
  { value: 'gastroenterology',   label: 'Gastroenterology' },
  { value: 'pulmonology',        label: 'Pulmonology / Respiratory' },
  { value: 'nephrology',         label: 'Nephrology / Kidneys' },
  { value: 'rheumatology',       label: 'Rheumatology' },
];

export const SYMPTOM_SPECIALTY_MAP: Record<string, string[]> = {
  cardiology: ['chest pain','heart attack','cardiac','palpitation','hypertension','high blood pressure','arrhythmia','ecg','cholesterol','angina','heart failure','irregular heartbeat','shortness of breath','chest tightness','cardiovascular','coronary','atrial fibrillation','bradycardia','tachycardia','heart murmur'],
  neurology: ['headache','migraine','seizure','epilepsy','stroke','numbness','tremor','brain','dizziness','vertigo','fainting','memory loss','confusion','paralysis','nerve pain','neuropathy','multiple sclerosis','parkinsons','dementia','concussion','tingling'],
  gynaecology: ['pregnancy','menstrual','ovarian','uterine','cervical','vaginal','contraception','pcos','menopause','period pain','irregular periods','fertility','endometriosis','fibroids','breast lump','vaginal discharge','pelvic pain','smear test','sti','sexual health'],
  dermatology: ['rash','skin','acne','eczema','psoriasis','dermatitis','lesion','mole','wart','hives','urticaria','itchy skin','dry skin','skin infection','ringworm','athlete foot','nail fungus','hair loss','alopecia','sebaceous cyst','skin cancer','wound healing'],
  paediatrics: ['child','infant','baby','toddler','vaccination','newborn','growth','developmental','childhood','pediatric','kids','teenager','adolescent','school age','nappy rash','teething','croup','hand foot mouth'],
  orthopaedics: ['fracture','bone','joint pain','arthritis','spine','back pain','knee pain','hip pain','shoulder pain','ankle','foot pain','muscle strain','sprain','tendon','ligament','carpal tunnel','sciatica','slipped disc','scoliosis','osteoporosis','sports injury'],
  psychiatry: ['depression','anxiety','bipolar','schizophrenia','mental health','ocd','ptsd','insomnia','panic attack','phobia','eating disorder','self harm','suicidal','addiction','stress','burnout','mood swings','hallucination','psychosis','social anxiety','trauma'],
  oncology: ['cancer','tumor','tumour','chemotherapy','malignant','biopsy','lymphoma','leukaemia','melanoma','carcinoma','mass','growth','abnormal cells','radiotherapy','oncology','metastasis','lymph node','blood cancer'],
  endocrinology: ['diabetes','thyroid','insulin','hormone','adrenal','cortisol','hyperthyroid','hypothyroid','weight gain','weight loss','polydipsia','polyuria','excessive thirst','blood sugar','hba1c','metabolic','pituitary','growth hormone','testosterone','oestrogen'],
  gastroenterology: ['stomach','bowel','intestine','liver','gallbladder','ibs','crohn','gastritis','ulcer','heartburn','acid reflux','indigestion','constipation','diarrhoea','diarrhea','bloating','nausea','vomiting','rectal bleeding','haemorrhoids','coeliac','colitis','hepatitis','jaundice'],
  pulmonology: ['asthma','copd','breathing difficulty','lung','respiratory','bronchitis','pneumonia','persistent cough','wheezing','sleep apnea','tuberculosis','pleural','pulmonary','oxygen','inhaler','breathlessness','chest infection','emphysema'],
  nephrology: ['kidney','renal','dialysis','urinary','creatinine','kidney stones','uti','urinary tract infection','blood in urine','protein in urine','frequent urination','painful urination','kidney failure','glomerulonephritis','nephrotic'],
  rheumatology: ['lupus','rheumatoid','gout','fibromyalgia','autoimmune','joint swelling','stiffness','vasculitis','sjogren','scleroderma','polymyalgia','ankylosing spondylitis','reactive arthritis','raynaud'],
  emergency_medicine: ['emergency','trauma','unconscious','unresponsive','severe bleeding','overdose','poisoning','severe allergic reaction','anaphylaxis','stroke symptoms','heart attack symptoms','severe chest pain','difficulty breathing','seizure now','major injury','accident'],
  general_medicine: ['fever','cold','flu','fatigue','cough','infection','allergy','allergic','hay fever','hayfever','pollen','runny nose','watery eyes','sneezing','itchy eyes','sore throat','earache','ear pain','blocked nose','tired','weakness','loss of appetite','general checkup','prescription renewal','vitamin deficiency','anaemia','dehydration','food poisoning','insect bite','minor cut','bruise','swollen glands','tonsillitis','sinusitis','cold sore','mouth ulcer','bad breath','general pain','malaise','body ache','night sweats','chills','loss of smell','loss of taste'],
};

// GET /doctor/profile
router.get('/profile', asyncHandler(async (req: any, res: any) => {
  const doctor = await prisma.doctor.findUnique({
    where: { userId: req.user.sub },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found' });
  res.json(doctor);
}));

// GET /doctor/specialties
router.get('/specialties', asyncHandler(async (_req: any, res: any) => {
  res.json(SPECIALTIES);
}));

// PUT /doctor/profile/specialty
router.put('/profile/specialty', asyncHandler(async (req: any, res: any) => {
  const { specialization, bio } = req.body;
  if (!specialization) throw new AppError('Specialization is required', 400);
  await (prisma.doctor as any).update({
    where: { userId: req.user.sub },
    data: { specialization, bio } as any,
  });
  res.json({ success: true, specialization });
}));

// GET /doctor/pending-cases
router.get('/pending-cases', asyncHandler(async (req: any, res: any) => {
  const doctor = await prisma.doctor.findUnique({
    where: { userId: req.user.sub },
    select: { specialization: true },
  });

  const mySpecialty = (doctor as any)?.specialization || 'general_medicine';

  // Try new multi-specialty approval system first
  let approvals: any[] = [];
  try {
    approvals = await (prisma as any).prescriptionApproval.findMany({
      where: {
        specialty: mySpecialty,
        OR: [
          { status: { in: ['pending', 'escalated'] } },
          { status: { in: ['approved', 'rejected'] }, doctorId: req.user.sub },
        ],
        prescription: {
          OR: [
            { doctorId: null },
            { doctor: { userId: req.user.sub } },
          ],
        },
      },
      include: {
        prescription: {
          include: {
            patient: {
              include: {
                user: { select: { name: true, email: true } },
              },
            },
            aiAnalysis: true,
            approvals: {
              select: {
                specialty: true,
                status: true,
                medications: true,
                notes: true,
                rejectionReason: true,
                safeToDispensePartial: true,
                partialDispenseNote: true,
                decidedAt: true,
                doctorId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  } catch (e) {
    // Fall back to legacy prescription system
  }

  if (approvals.length > 0) {
    const cases = approvals.map((approval: any) => {
      const rx = approval.prescription;
      return {
        approvalId: approval.id,
        id: rx.id,
        status: approval.status,
        createdAt: approval.createdAt,
        mySpecialty,
        myMedications: approval.medications,
        patient: rx.patient,
        aiAnalysis: rx.aiAnalysis ? {
          aiSummary: rx.aiAnalysis.aiSummary,
          suggestedMedication: approval.medications,
          confidenceScore: rx.aiAnalysis.confidenceScore,
          warnings: rx.aiAnalysis.warnings || [],
          recommendedTests: rx.aiAnalysis.recommendedTests || [],
          lifestyleAdvice: rx.aiAnalysis.lifestyleAdvice || [],
          dietaryAdvice: rx.aiAnalysis.dietaryAdvice || [],
          whenToSeekEmergency: rx.aiAnalysis.whenToSeekEmergency || [],
          report: { description: rx.aiAnalysis.aiSummary },
        } : null,
        otherApprovals: (rx.approvals || [])
          .filter((a: any) => a.specialty !== mySpecialty)
          .map((a: any) => ({
            specialty: a.specialty,
            status: a.status,
            doctorName: 'Specialist',
            decidedAt: a.decidedAt,
          })),
      };
    });
    return res.json(cases);
  }

  // Legacy fallback - show all pending prescriptions to this doctor
  const prescriptions = await prisma.prescription.findMany({
    where: {
      status: 'pending_review',
      doctorId: req.user.sub,
    },
    include: {
      patient: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
      aiAnalysis: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const legacyCases = prescriptions.map((rx: any) => ({
    approvalId: null,
    id: rx.id,
    status: rx.status,
    createdAt: rx.createdAt,
    mySpecialty,
    myMedications: rx.aiAnalysis?.suggestedMedication || [],
    patient: rx.patient,
    aiAnalysis: rx.aiAnalysis ? {
      aiSummary: rx.aiAnalysis.aiSummary,
      suggestedMedication: rx.aiAnalysis.suggestedMedication || [],
      confidenceScore: rx.aiAnalysis.confidenceScore,
      warnings: rx.aiAnalysis.warnings || [],
      report: { description: rx.aiAnalysis.aiSummary },
    } : null,
    otherApprovals: [],
  }));

  res.json(legacyCases);
}));

// POST /doctor/prescriptions/:id/approve
router.post('/prescriptions/:id/approve', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const { medications, notes, validDays = 30, safeToDispensePartial = false, partialDispenseNote } = req.body;

  const doctor = await prisma.doctor.findUnique({
    where: { userId: req.user.sub },
    select: { specialization: true },
  });
  const mySpecialty = (doctor as any)?.specialization || 'general_medicine';

  // Try new approval system
  try {
    const approval = await (prisma as any).prescriptionApproval.findFirst({
      where: { prescriptionId: id, specialty: mySpecialty, status: { in: ['pending', 'escalated'] } },
    });

    if (approval) {
      await (prisma as any).prescriptionApproval.update({
        where: { id: approval.id },
        data: {
          status: 'approved',
          doctorId: req.user.sub,
          medications: medications || approval.medications,
          notes,
          safeToDispensePartial,
          partialDispenseNote,
          decidedAt: new Date(),
        },
      });

      const allApprovals = await (prisma as any).prescriptionApproval.findMany({
        where: { prescriptionId: id },
      });

      const allApproved = allApprovals.every((a: any) => a.status === 'approved');

      if (allApproved) {
        const allMeds = allApprovals.flatMap((a: any) => a.medications as any[]);
        await prisma.prescription.update({
          where: { id },
          data: { status: 'approved', medications: allMeds } as any,
        });
      } else if (safeToDispensePartial) {
        const approvedMeds = allApprovals
          .filter((a: any) => a.status === 'approved')
          .flatMap((a: any) => a.medications as any[]);
        await prisma.prescription.update({
          where: { id },
          data: { status: 'approved', medications: approvedMeds } as any,
        });
      }

      await auditLog({
        userId: req.user.sub,
        action: 'PRESCRIPTION_APPROVED',
        resourceType: 'prescription',
        resourceId: id,
        newValue: { specialty: mySpecialty, safeToDispensePartial },
      });

      return res.json({ success: true, allApproved, message: allApproved ? 'Fully approved' : 'Your section approved' });
    }
  } catch (e) {
    // Fall through to legacy
  }

  // Legacy approval
  await prisma.prescription.update({
    where: { id },
    data: {
      status: 'approved',
      doctorId: req.user.sub,
      medications: medications || [],
      doctorNotes: notes,
      approvedAt: new Date(),
      validUntil: new Date(Date.now() + validDays * 24 * 60 * 60 * 1000),
    } as any,
  });

  await auditLog({
    userId: req.user.sub,
    action: 'PRESCRIPTION_APPROVED',
    resourceType: 'prescription',
    resourceId: id,
  });

  res.json({ success: true, allApproved: true, message: 'Prescription approved' });
}));

// POST /doctor/prescriptions/:id/reject
router.post('/prescriptions/:id/reject', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const { reason, notes } = req.body;
  if (!reason || reason.length < 10) throw new AppError('Please provide a detailed rejection reason', 400);

  const doctor = await prisma.doctor.findUnique({
    where: { userId: req.user.sub },
    select: { specialization: true },
  });
  const mySpecialty = (doctor as any)?.specialization || 'general_medicine';

  try {
    const approval = await (prisma as any).prescriptionApproval.findFirst({
      where: { prescriptionId: id, specialty: mySpecialty, status: { in: ['pending', 'escalated'] } },
    });

    if (approval) {
      await (prisma as any).prescriptionApproval.update({
        where: { id: approval.id },
        data: { status: 'rejected', doctorId: req.user.sub, rejectionReason: reason, notes, decidedAt: new Date() },
      });
    }
  } catch (e) {}

  await prisma.prescription.update({
    where: { id },
    data: { status: 'rejected', doctorId: req.user.sub, rejectionReason: reason } as any,
  });

  await auditLog({
    userId: req.user.sub,
    action: 'PRESCRIPTION_REJECTED',
    resourceType: 'prescription',
    resourceId: id,
    newValue: { reason, specialty: mySpecialty },
  });

  res.json({ success: true, message: 'Prescription rejected' });
}));

// GET /doctor/escalations
router.get('/escalations', asyncHandler(async (req: any, res: any) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.sub },
      select: { specialization: true },
    });
    const mySpecialty = (doctor as any)?.specialization || 'general_medicine';
    const escalations = await (prisma as any).prescriptionEscalation.findMany({
      where: { specialty: mySpecialty, resolved: false },
      orderBy: { createdAt: 'asc' },
    });
    res.json(escalations);
  } catch (e) {
    res.json([]);
  }
}));

// GET /doctor/verification-status
router.get('/verification-status', asyncHandler(async (req: any, res: any) => {
  const doctor = await prisma.doctor.findUnique({
    where: { userId: req.user.sub },
    include: { user: { select: { status: true } } },
  });
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  const userStatus = (doctor.user as any)?.status || 'unverified';
  const status = userStatus === 'verified' ? 'approved' : (doctor as any).verificationDocs ? 'pending' : 'unverified';
  const rejectionReason = (doctor as any).verificationRejectedReason || null;
  res.json({ status, rejectionReason, doctor });
}));

// POST /doctor/submit-verification
const verifyUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const s3Doc = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

router.post('/submit-verification', verifyUpload.any(), asyncHandler(async (req: any, res: any) => {
  const files = (req.files || []) as any[];
  if (!files.length) throw new AppError('No documents uploaded', 400);
  const uploadedKeys: Record<string, string> = {};
  for (const file of files) {
    const key = 'doctor-docs/' + req.user.sub + '/' + file.fieldname + '-' + crypto.randomUUID();
    await s3Doc.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET as string,
      Key: key,
      Body: file.buffer as Buffer,
      ContentType: file.mimetype as string,
      ServerSideEncryption: 'AES256',
    }));
    uploadedKeys[file.fieldname] = key;
  }
  await (prisma as any).doctor.update({
    where: { userId: req.user.sub },
    data: { verificationDocs: uploadedKeys } as any,
  });
  await prisma.user.update({
    where: { id: req.user.sub },
    data: { status: 'pending' } as any,
  });
  res.json({ success: true, message: 'Documents submitted for review' });
}));

export { router as doctorRouter };
export default router;
