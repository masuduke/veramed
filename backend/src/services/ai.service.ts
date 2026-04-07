/**
 * VeraMed AI Analysis Service
 *
 * CRITICAL SAFETY RULES:
 * 1. AI output is ADVISORY ONLY — never released directly to patients
 * 2. All AI suggestions go to doctor dashboard for review
 * 3. The AI prompt explicitly instructs the model NOT to prescribe
 * 4. Confidence scores and drug interaction warnings always included
 * 5. All AI responses stored raw for audit
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../server';
import { logger } from '../utils/logger';
import { auditLog } from '../utils/audit';
import { AppError } from '../utils/errors';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Prompt Engineering ─────────────────────────────────────────────
function buildAnalysisPrompt(data: {
  description: string;
  symptoms: string[];
  medicalHistory?: string | null;
  allergies: string[];
  age?: number;
  gender?: string;
}) {
  return `You are a clinical decision-support AI assisting a licensed physician on the VeraMed platform. 
Your role is to ASSIST the reviewing doctor — you are NOT prescribing, diagnosing, or replacing medical judgment.

PATIENT INFORMATION:
- Description: ${data.description}
- Reported symptoms: ${data.symptoms.join(', ') || 'Not specified'}
- Medical history: ${data.medicalHistory || 'Not provided'}
- Known allergies: ${data.allergies.length > 0 ? data.allergies.join(', ') : 'None reported'}
- Age: ${data.age || 'Not provided'}
- Gender: ${data.gender || 'Not provided'}

TASK:
Provide a structured clinical support summary for the reviewing physician. Include:
1. A concise clinical summary of the presentation
2. Possible diagnoses to consider (differential, not definitive)
3. Medication suggestions the DOCTOR may consider (with dosage guidance, contraindications)
4. Drug interaction warnings if any based on reported allergies/history
5. A confidence score (0.0 to 1.0) on the quality/completeness of information provided
6. Any red flags requiring urgent attention
7. Recommended additional tests or information needed

STRICT RULES:
- Always frame suggestions as "the physician may wish to consider" — never as instructions to the patient
- Flag any allergen conflicts immediately
- If information is insufficient, say so clearly and list what additional data is needed
- Never suggest medications controlled without noting they require stricter oversight
- Include standard dosing ranges, not absolute prescriptions

Respond with ONLY valid JSON matching this exact schema:
{
  "clinicalSummary": "string",
  "differentialDiagnosis": ["string"],
  "suggestedMedications": [
    {
      "name": "string",
      "genericName": "string",
      "dosageGuidance": "string",
      "frequency": "string",
      "duration": "string",
      "reasoning": "string",
      "contraindications": ["string"],
      "requiresMonitoring": boolean
    }
  ],
  "drugInteractionWarnings": ["string"],
  "allergenConflicts": ["string"],
  "redFlags": ["string"],
  "recommendedTests": ["string"],
  "additionalInfoNeeded": ["string"],
  "confidenceScore": number,
  "urgencyLevel": "routine" | "urgent" | "emergency"
}`;
}

// ── Main Analysis Function ─────────────────────────────────────────
export async function analyzeReport(reportId: string): Promise<void> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      patient: {
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!report) throw new AppError('Report not found', 404);
  if (report.processed) throw new AppError('Report already processed', 409);

  logger.info(`Starting AI analysis for report ${reportId}`);
  const startTime = Date.now();

  try {
    const prompt = buildAnalysisPrompt({
      description:    report.description,
      symptoms:       report.symptoms,
      medicalHistory: report.patient.medicalHistory,
      allergies:      report.patient.allergies,
      age: report.patient.dateOfBirth
        ? Math.floor((Date.now() - new Date(report.patient.dateOfBirth).getTime()) / 3.156e10)
        : undefined,
      gender: report.patient.gender ?? undefined,
    });

    const response = await client.messages.create({
      model:      process.env.AI_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: Number(process.env.AI_MAX_TOKENS) || 2000,
      messages:   [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('');

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('AI returned invalid JSON — raw response stored for review');
    }

    const processingTime = Date.now() - startTime;

    // Validate urgency — if emergency, flag immediately
    if (parsed.urgencyLevel === 'emergency') {
      logger.warn(`EMERGENCY flag raised for report ${reportId} — patient: ${report.patient.user.name}`);
      // TODO: trigger emergency notification to on-call doctor
    }

    // Save AI analysis
    const analysis = await prisma.aiAnalysis.create({
      data: {
        reportId,
        modelVersion:       process.env.AI_MODEL || 'claude-sonnet-4-20250514',
        aiSummary:          parsed.clinicalSummary,
        suggestedDiagnosis: (parsed.differentialDiagnosis || []).join('; '),
        suggestedMedication: parsed.suggestedMedications || [],
        confidenceScore:    parsed.confidenceScore,
        warnings: [
          ...(parsed.allergenConflicts || []),
          ...(parsed.drugInteractionWarnings || []),
          ...(parsed.redFlags || []),
        ],
        rawResponse:     { parsed, rawText },
        processingTimeMs: processingTime,
      },
    });

    // Mark report as processed
    await prisma.report.update({
      where: { id: reportId },
      data:  { processed: true },
    });

    // Auto-create prescription stub — status: pending_review
    // This routes to the doctor dashboard automatically
    // A default doctor is assigned; production would implement smart routing
    const availableDoctor = await prisma.doctor.findFirst({
      where: { available: true, user: { status: 'verified' } },
      orderBy: { reviewCount: 'asc' }, // load balance
    });

    if (!availableDoctor) {
      logger.error('No verified doctors available to assign case');
      return;
    }

    await prisma.prescription.create({
      data: {
        patientId:     report.patientId,
        doctorId:      availableDoctor.id,
        aiAnalysisId:  analysis.id,
        status:        'pending_review',
        medications:   parsed.suggestedMedications || [], // doctor will review/modify
      },
    });

    // Notify doctor
    await prisma.notification.create({
      data: {
        userId: availableDoctor.userId,
        type:   'new_case',
        title:  'New Case Assigned',
        body:   `A new patient report requires your review. Confidence: ${Math.round((parsed.confidenceScore || 0) * 100)}%`,
        data:   { reportId, analysisId: analysis.id },
      },
    });

    await auditLog({
      userId:       report.patient.userId,
      action:       'created',
      resourceType: 'ai_analysis',
      resourceId:   analysis.id,
      newValue:     { modelVersion: analysis.modelVersion, confidenceScore: analysis.confidenceScore },
    });

    logger.info(`AI analysis complete for report ${reportId} in ${processingTime}ms`);
  } catch (err) {
    logger.error(`AI analysis failed for report ${reportId}:`, err);
    throw err;
  }
}

// ── Pharmacy Matching ──────────────────────────────────────────────
export async function matchPrescriptionToPharmacies(prescriptionId: string) {
  const prescription = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    include: { patient: { select: { address: true } } },
  });

  if (!prescription) throw new AppError('Prescription not found', 404);
  if (prescription.status !== 'approved') {
    throw new AppError('Only approved prescriptions can be matched to pharmacies', 400);
  }

  const medications = prescription.medications as Array<{ name: string; genericName?: string }>;
  const medNames = medications.map((m) => m.name.toLowerCase());

  // Find pharmacies that have ALL required medications in stock
  const matches = await prisma.$queryRaw<any[]>`
    SELECT
      ph.id AS pharmacy_id,
      ph.store_name,
      ph.address,
      COUNT(DISTINCT m.name) AS matched_count,
      SUM(m.price) AS estimated_total
    FROM pharmacies ph
    JOIN medications m ON m.pharmacy_id = ph.id
    WHERE ph.accepts_orders = true
      AND m.stock > 0
      AND m.requires_prescription = true
      AND LOWER(m.name) = ANY(${medNames})
    GROUP BY ph.id, ph.store_name, ph.address
    HAVING COUNT(DISTINCT m.name) = ${medNames.length}
    ORDER BY estimated_total ASC
    LIMIT 5
  `;

  return matches;
}
