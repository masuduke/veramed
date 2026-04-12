// ============================================================
// UPDATED AI SERVICE
// File: backend/src/services/ai.service.ts (replace existing)
// ============================================================
import Anthropic from '@anthropic-ai/sdk';
import { SYMPTOM_SPECIALTY_MAP } from '../routes/doctor.routes';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AIAnalysisResult {
  aiSummary: string;
  suggestedDiagnosis: string;
  suggestedMedication: Medication[];
  medicationsBySpecialty: Record<string, Medication[]>;
  requiredSpecialties: string[];
  confidenceScore: number;
  warnings: string[];
  urgencyLevel: 'routine' | 'urgent' | 'emergency';
  referralRecommended: boolean;
  referralNote?: string;
}

export interface Medication {
  name: string;
  genericName: string;
  dosageGuidance: string;
  frequency: string;
  duration: string;
  reasoning: string;
  contraindications: string[];
  requiresMonitoring: boolean;
  specialty: string; // which specialty should approve this
}

export async function analyzeReport(
  description: string,
  symptoms: string[],
  fileText?: string
): Promise<AIAnalysisResult> {

  const SAFETY_SYSTEM_PROMPT = `You are a clinical decision support AI for VeraMed.
CRITICAL RULES:
1. You NEVER prescribe medication independently
2. All suggestions are ADVISORY ONLY for licensed doctor review
3. You MUST identify which medical specialty should review each medication
4. You MUST flag if multiple specialists are needed
5. You MUST assign each medication to exactly one specialty
6. Return ONLY valid JSON, no markdown, no explanation outside JSON

Available specialties: general_medicine, cardiology, gynaecology, dermatology, 
neurology, paediatrics, orthopaedics, psychiatry, oncology, emergency_medicine,
endocrinology, gastroenterology, pulmonology, nephrology, rheumatology`;

  const prompt = `Analyse this patient case and return a JSON object.

PATIENT DESCRIPTION: ${description}
SYMPTOMS: ${symptoms.join(', ') || 'None specified'}
${fileText ? `REPORT CONTENT: ${fileText.slice(0, 2000)}` : ''}

Return this exact JSON structure (no markdown, no backticks):
{
  "aiSummary": "2-3 sentence clinical summary",
  "suggestedDiagnosis": "Most likely diagnosis or differential",
  "urgencyLevel": "routine|urgent|emergency",
  "requiredSpecialties": ["specialty1", "specialty2"],
  "confidenceScore": 0.0-1.0,
  "warnings": ["any red flags or contraindications"],
  "referralRecommended": true|false,
  "referralNote": "if referral needed, explain why",
  "suggestedMedication": [
    {
      "name": "Drug name and dose",
      "genericName": "Generic name",
      "dosageGuidance": "Specific dosage",
      "frequency": "How often",
      "duration": "How long",
      "reasoning": "Clinical reasoning",
      "contraindications": ["list contraindications"],
      "requiresMonitoring": true|false,
      "specialty": "which specialty should approve THIS medication"
    }
  ]
}`;

  try {
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: parseInt(process.env.AI_MAX_TOKENS || '2000'),
      system: SAFETY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Group medications by specialty
    const medicationsBySpecialty: Record<string, Medication[]> = {};
    for (const med of (parsed.suggestedMedication || [])) {
      const spec = med.specialty || 'general_medicine';
      if (!medicationsBySpecialty[spec]) medicationsBySpecialty[spec] = [];
      medicationsBySpecialty[spec].push(med);
    }

    // Validate specialties - ensure all required ones are real
    const validSpecialties = Object.keys(SYMPTOM_SPECIALTY_MAP);
    const requiredSpecialties = (parsed.requiredSpecialties || ['general_medicine'])
      .filter((s: string) => validSpecialties.includes(s));

    if (requiredSpecialties.length === 0) requiredSpecialties.push('general_medicine');

    return {
      aiSummary: parsed.aiSummary || 'Analysis complete. Doctor review required.',
      suggestedDiagnosis: parsed.suggestedDiagnosis || 'Further evaluation needed',
      suggestedMedication: parsed.suggestedMedication || [],
      medicationsBySpecialty,
      requiredSpecialties,
      confidenceScore: Math.min(1, Math.max(0, parsed.confidenceScore || 0.5)),
      warnings: parsed.warnings || [],
      urgencyLevel: parsed.urgencyLevel || 'routine',
      referralRecommended: parsed.referralRecommended || false,
      referralNote: parsed.referralNote,
    };

  } catch (err) {
    console.error('AI analysis failed:', err);
    // Safe fallback - still requires doctor review
    return {
      aiSummary: 'AI analysis could not be completed. A doctor will review your case manually.',
      suggestedDiagnosis: 'Manual review required',
      suggestedMedication: [],
      medicationsBySpecialty: {},
      requiredSpecialties: ['general_medicine'],
      confidenceScore: 0,
      warnings: ['AI analysis unavailable — manual doctor review required'],
      urgencyLevel: 'routine',
      referralRecommended: false,
    };
  }
}

