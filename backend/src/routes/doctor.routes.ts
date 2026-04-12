// ============================================================
// MULTI-SPECIALTY BACKEND ROUTES
// File: backend/src/routes/doctor.routes.ts (replace existing)
// ============================================================
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { AppError } from '../utils/errors';
import { auditLog } from '../utils/audit';
import { prisma } from '../server';

const router = Router();
router.use(authenticate, authorize('doctor'));

// ── SPECIALTY CONSTANTS ──────────────────────────────────────
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

// ── SPECIALTY MAP (AI keywords → specialty) ──────────────────
export const SYMPTOM_SPECIALTY_MAP: Record<string, string[]> = {
  cardiology:       ['chest pain','heart','cardiac','palpitation','hypertension','blood pressure','arrhythmia','ecg','ekg','cholesterol','angina','coronary'],
  neurology:        ['headache','migraine','seizure','epilepsy','stroke','numbness','tremor','parkinson','alzheimer','multiple sclerosis','brain'],
  gynaecology:      ['pregnancy','menstrual','ovarian','uterine','cervical','vaginal','contraception','pcos','endometriosis','menopause'],
  dermatology:      ['rash','skin','acne','eczema','psoriasis','dermatitis','urticaria','lesion','melanoma'],
  paediatrics:      ['child','infant','baby','toddler','vaccination','growth','developmental','newborn'],
  orthopaedics:     ['fracture','bone','joint','arthritis','spine','back pain','knee','hip','shoulder','tendon','ligament'],
  psychiatry:       ['depression','anxiety','bipolar','schizophrenia','mental','ocd','ptsd','insomnia','eating disorder'],
  oncology:         ['cancer','tumor','tumour','chemotherapy','radiation','malignant','biopsy','lymphoma','leukemia'],
  endocrinology:    ['diabetes','thyroid','insulin','hormone','adrenal','pituitary','cortisol','hyperthyroid'],
  gastroenterology: ['stomach','bowel','intestine','liver','gallbladder','ibs','crohn','colitis','gastritis','ulcer','hepatitis'],
  pulmonology:      ['asthma','copd','breathing','lung','respiratory','bronchitis','pneumonia','oxygen'],
  nephrology:       ['kidney','renal','dialysis','urinary','proteinuria','creatinine'],
  rheumatology:     ['lupus','rheumatoid','gout','fibromyalgia','sjogren','vasculitis','autoimmune'],
  general_medicine: ['fever','cold','flu','fatigue','cough','weight','vitamin','infection','antibiotics'],
};

// ── HELPER: Determine required specialties from AI analysis ──
export function determineRequiredSpecialties(
  description: string,
  symptoms: string[],
  aiSummary: string,
  suggestedMedications: any[]
): string[] {
  const text = [description, ...symptoms, aiSummary,
    ...suggestedMedications.map(m => m.name + ' ' + (m.reasoning || ''))
  ].join(' ').toLowerCase();

  const matched = new Set<string>();

  for (const [specialty, keywords] of Object.entries(SYMPTOM_SPECIALTY_MAP)) {
    if (keywords.some(kw => text.includes(kw))) {
      matched.add(specialty);
    }
  }

  // Always include general_medicine as fallback
  if (matched.size === 0) matched.add('general_medicine');

  // Split medications by specialty
  return Array.from(matched);
}

// ── HELPER: Split medications by specialty ───────────────────
function splitMedicationsBySpecialty(
  medications: any[],
  specialties: string[]
): Record<string, any[]> {
  const split: Record<string, any[]> = {};
  specialties.forEach(s => { split[s] = []; });

  for (const med of medications) {
    const medText = (med.name + ' ' + (med.reasoning || '')).toLowerCase();
    let assigned = false;

    for (const specialty of specialties) {
      const keywords = SYMPTOM_SPECIALTY_MAP[specialty] || [];
      if (keywords.some(kw => medText.includes(kw))) {
        split[specialty].push(med);
        assigned = true;
        break;
      }
    }

    // If no specialty match, assign to general_medicine
    if (!assigned) {
      if (split['general_medicine']) {
        split['general_medicine'].push(med);
      } else {
        split[specialties[0]].push(med);
      }
    }
  }

  return split;
}

// ── GET /pending-cases ───────────────────────────────────────
// Returns cases matching THIS doctor's specialty
router.get('/pending-cases', asyncHandler(async (req: any, res: any) => {
  const doctor = await prisma.doctor.findUnique({
    where: { userId: req.user.id },
    select: { specialization: true, userId: true },
  });
  if (!doctor) throw new AppError('Doctor profile not found', 404);

  const mySpecialty = doctor.specialization || 'general_medicine';

  // Get prescription approvals assigned to this specialty that are pending
  const approvals = await prisma.prescriptionApproval.findMany({
    where: {
      specialty: mySpecialty,
      status: { in: ['pending', 'escalated'] },
      OR: [
        { doctorId: null },           // unassigned
        { doctorId: req.user.id },    // assigned to me
      ],
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
          approvals: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const cases = approvals.map((approval: any) => {
    const rx = approval.prescription;
    const analysis = rx.aiAnalyses[0];

    return {
      approvalId: approval.id,
      id: rx.id,
      status: approval.status,
      createdAt: approval.createdAt,
      mySpecialty,
      myMedications: approval.medications,
      patient: rx.patient,
      aiAnalysis: analysis ? {
        aiSummary: analysis.aiSummary,
        suggestedDiagnosis: analysis.suggestedDiagnosis,
        suggestedMedication: approval.medications, // Only this specialty's meds
        allMedications: analysis.suggestedMedication, // Full list
        confidenceScore: analysis.confidenceScore,
        warnings: analysis.warnings,
        requiredSpecialties: rx.requiredSpecialties,
        report: analysis.report,
      } : null,
      // Show other specialties' statuses (read-only context)
      otherApprovals: rx.approvals
        .filter((a: any) => a.specialty !== mySpecialty)
        .map((a: any) => ({
          specialty: a.specialty,
          status: a.status,
          doctorName: a.doctor?.user?.name || 'Unassigned',
          decidedAt: a.decidedAt,
        })),
    };
  });

  res.json(cases);
}));

// ── POST /prescriptions/:id/approve ─────────────────────────
router.post('/prescriptions/:id/approve', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const { medications, notes, validDays = 30,
          safeToDispensePartial = false, partialDispenseNote } = req.body;

  const doctor = await prisma.doctor.findUnique({
    where: { userId: req.user.id },
    select: { specialization: true },
  });
  if (!doctor) throw new AppError('Doctor profile not found', 404);

  const mySpecialty = doctor.specialization || 'general_medicine';

  // Find the approval record for this specialty
  const approval = await prisma.prescriptionApproval.findFirst({
    where: {
      prescriptionId: id,
      specialty: mySpecialty,
      status: { in: ['pending', 'escalated'] },
    },
  });
  if (!approval) throw new AppError('No pending approval found for your specialty', 404);

  // Update approval record
  await prisma.prescriptionApproval.update({
    where: { id: approval.id },
    data: {
      status: 'approved',
      doctorId: req.user.id,
      medications: medications || approval.medications,
      notes,
      safeToDispensePartial,
      partialDispenseNote,
      decidedAt: new Date(),
    },
  });

  // Audit log
  await auditLog({
    userId: req.user.id,
    action: 'PRESCRIPTION_SPECIALTY_APPROVED',
    resourceType: 'prescription',
    resourceId: id,
    newValue: { specialty: mySpecialty, safeToDispensePartial, medications },
  });

  // Check if all specialties are now approved (trigger handles this in DB)
  const allApprovals = await prisma.prescriptionApproval.findMany({
    where: { prescriptionId: id },
  });

  const allApproved = allApprovals.every((a: any) => a.status === 'approved');
  const anyPartial = allApprovals.some((a: any) => a.safeToDispensePartial && a.status === 'approved');
  const pendingCount = allApprovals.filter((a: any) => a.status === 'pending').length;

  // Merge all approved medications into prescription
  if (allApproved) {
    const allMedications = allApprovals.flatMap((a: any) => a.medications as any[]);
    await prisma.prescription.update({
      where: { id },
      data: {
        status: 'approved',
        medications: allMedications,
        approvedAt: new Date(),
      },
    });
  } else if (anyPartial) {
    // Partial approval — collect approved meds only
    const approvedMeds = allApprovals
      .filter((a: any) => a.status === 'approved')
      .flatMap((a: any) => a.medications as any[]);
    await prisma.prescription.update({
      where: { id },
      data: {
        status: 'approved',
        safeToDispensePartial: true,
        medications: approvedMeds,
      },
    });
  }

  res.json({
    success: true,
    message: allApproved
      ? 'Prescription fully approved — patient notified'
      : safeToDispensePartial
        ? `Your specialty approved. Patient can order approved meds. ${pendingCount} specialty pending.`
        : `Your specialty approved. Waiting for ${pendingCount} more specialty approval(s).`,
    allApproved,
    pendingSpecialties: allApprovals
      .filter((a: any) => a.status === 'pending')
      .map((a: any) => a.specialty),
  });
}));

// ── POST /prescriptions/:id/reject ──────────────────────────
router.post('/prescriptions/:id/reject', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const { reason, notes } = req.body;
  if (!reason || reason.length < 10) throw new AppError('Please provide a detailed rejection reason', 400);

  const doctor = await prisma.doctor.findUnique({
    where: { userId: req.user.id },
    select: { specialization: true },
  });
  const mySpecialty = doctor?.specialization || 'general_medicine';

  const approval = await prisma.prescriptionApproval.findFirst({
    where: { prescriptionId: id, specialty: mySpecialty, status: { in: ['pending','escalated'] } },
  });
  if (!approval) throw new AppError('No pending approval found for your specialty', 404);

  await prisma.prescriptionApproval.update({
    where: { id: approval.id },
    data: {
      status: 'rejected',
      doctorId: req.user.id,
      rejectionReason: reason,
      notes,
      decidedAt: new Date(),
    },
  });

  // If this specialty's rejection makes the whole prescription invalid
  await prisma.prescription.update({
    where: { id },
    data: { status: 'rejected' },
  });

  await auditLog({
    userId: req.user.id,
    action: 'PRESCRIPTION_SPECIALTY_REJECTED',
    resourceType: 'prescription',
    resourceId: id,
    newValue: { specialty: mySpecialty, reason },
  });

  res.json({ success: true, message: 'Prescription rejected. Patient has been notified.' });
}));

// ── GET /specialties ─────────────────────────────────────────
router.get('/specialties', asyncHandler(async (_req: any, res: any) => {
  res.json(SPECIALTIES);
}));

// ── PUT /profile/specialty ───────────────────────────────────
router.put('/profile/specialty', asyncHandler(async (req: any, res: any) => {
  const { specialization, bio, yearsExperience } = req.body;
  if (!specialization) throw new AppError('Specialization is required', 400);

  await prisma.doctor.update({
    where: { userId: req.user.id },
    data: { specialization, bio } as any,
  });

  res.json({ success: true, specialization });
}));

// ── GET /escalations ─────────────────────────────────────────
// Cases escalated due to timeout (admin only but useful for senior doctors)
router.get('/escalations', asyncHandler(async (req: any, res: any) => {
  const doctor = await prisma.doctor.findUnique({
    where: { userId: req.user.id },
    select: { specialization: true },
  });
  const mySpecialty = doctor?.specialization || 'general_medicine';

  const escalations = await prisma.prescriptionEscalation.findMany({
    where: { specialty: mySpecialty, resolved: false },
    include: {
      prescription: {
        include: {
          patient: { include: { user: { select: { name: true, email: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json(escalations);
}));

export { router as doctorRouter };
export default router;

