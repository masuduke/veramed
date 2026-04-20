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
  recommendedTests: RecommendedTest[];
  lifestyleAdvice: string[];
  dietaryAdvice: string[];
  whenToSeekEmergency: string[];
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
  specialty: string;
}

export interface RecommendedTest {
  testName: string;
  reason: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  testType: 'blood' | 'urine' | 'imaging' | 'swab' | 'biopsy' | 'ecg' | 'other';
}

export async function analyzeReport(
  description: string,
  symptoms: string[],
  fileText?: string,
  patientContext?: string
): Promise<AIAnalysisResult> {

  const SAFETY_SYSTEM_PROMPT = `You are a clinical decision support AI for VeraMed.
CRITICAL RULES:
1. You NEVER prescribe medication independently
2. All suggestions are ADVISORY ONLY for licensed doctor review
3. You MUST identify which medical specialty should review each medication
4. You MUST flag if multiple specialists are needed
5. You MUST assign each medication to exactly one specialty
6. You MUST recommend relevant diagnostic tests before medication where appropriate
7. You MUST provide lifestyle, hydration, dietary and self-care advice
8. Return ONLY valid JSON, no markdown, no explanation outside JSON

Available specialties: general_medicine, cardiology, gynaecology, dermatology,
neurology, paediatrics, orthopaedics, psychiatry, oncology, emergency_medicine,
endocrinology, gastroenterology, pulmonology, nephrology, rheumatology`;

  const prompt = `Analyse this patient case thoroughly and return a comprehensive JSON object.

PATIENT INFORMATION: 
PATIENT DESCRIPTION: ${description}
SYMPTOMS: ${symptoms.join(', ') || 'None specified'}
${fileText ? `REPORT/TEST RESULTS: ${fileText.slice(0, 3000)}` : ''}

Return this EXACT JSON structure (no markdown, no backticks):
{
  "aiSummary": "3-4 sentence clinical summary including symptom duration, severity and key concerns",
  "suggestedDiagnosis": "Most likely diagnosis with differential diagnoses listed",
  "urgencyLevel": "routine|urgent|emergency",
  "requiredSpecialties": ["specialty1", "specialty2"],
  "confidenceScore": 0.0-1.0,
  "warnings": ["specific red flags or contraindications to watch for"],
  "referralRecommended": true|false,
  "referralNote": "explanation if referral needed",
  "recommendedTests": [
    {
      "testName": "Full Blood Count (FBC)",
      "reason": "To check for infection, anaemia or immune response",
      "urgency": "urgent",
      "testType": "blood"
    },
    {
      "testName": "C-Reactive Protein (CRP)",
      "reason": "Inflammation marker to distinguish viral vs bacterial infection",
      "urgency": "urgent",
      "testType": "blood"
    }
  ],
  "lifestyleAdvice": [
    "Rest as much as possible and avoid strenuous activity",
    "Stay well hydrated - aim for 2-3 litres of water per day",
    "Monitor temperature every 4-6 hours and keep a record"
  ],
  "dietaryAdvice": [
    "Eat light, easily digestible foods such as soups, broths and toast",
    "Avoid alcohol and caffeine which can worsen dehydration",
    "Include vitamin C rich foods like oranges and berries to support immunity"
  ],
  "whenToSeekEmergency": [
    "Temperature exceeds 40 degrees Celsius",
    "Difficulty breathing or chest pain develops",
    "Confusion, severe headache or stiff neck appears"
  ],
  "suggestedMedication": [
    {
      "name": "Drug name and dose",
      "genericName": "Generic name",
      "dosageGuidance": "Specific dosage",
      "frequency": "How often",
      "duration": "How long",
      "reasoning": "Clinical reasoning for this medication",
      "contraindications": ["list contraindications"],
      "requiresMonitoring": true|false,
      "specialty": "which specialty should approve THIS medication"
    }
  ]
}`;

  try {
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: parseInt(process.env.AI_MAX_TOKENS || '3000'),
      system: SAFETY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const medicationsBySpecialty: Record<string, Medication[]> = {};
    for (const med of (parsed.suggestedMedication || [])) {
      const spec = med.specialty || 'general_medicine';
      if (!medicationsBySpecialty[spec]) medicationsBySpecialty[spec] = [];
      medicationsBySpecialty[spec].push(med);
    }

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
      recommendedTests: parsed.recommendedTests || [],
      lifestyleAdvice: parsed.lifestyleAdvice || [],
      dietaryAdvice: parsed.dietaryAdvice || [],
      whenToSeekEmergency: parsed.whenToSeekEmergency || [],
    };

  } catch (err) {
    console.error('AI analysis failed:', err);
    return {
      aiSummary: 'AI analysis could not be completed. A doctor will review your case manually.',
      suggestedDiagnosis: 'Manual review required',
      suggestedMedication: [],
      medicationsBySpecialty: {},
      requiredSpecialties: ['general_medicine'],
      confidenceScore: 0,
      warnings: ['AI analysis unavailable - manual doctor review required'],
      urgencyLevel: 'routine',
      referralRecommended: false,
      recommendedTests: [],
      lifestyleAdvice: ['Rest and stay hydrated', 'Monitor your symptoms'],
      dietaryAdvice: ['Eat light nutritious meals', 'Stay well hydrated'],
      whenToSeekEmergency: ['Symptoms worsen significantly', 'Difficulty breathing', 'High fever above 39 degrees'],
    };
  }
}