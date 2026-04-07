'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { AlertTriangle, CheckCircle, XCircle, FileText, User, Brain, Pill } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
interface Medication {
  name:               string;
  genericName:        string;
  dosageGuidance:     string;
  frequency:          string;
  duration:           string;
  reasoning:          string;
  contraindications:  string[];
  requiresMonitoring: boolean;
}

interface CaseDetail {
  id:           string;
  status:       string;
  patient: {
    user:          { name: string; email: string };
    dateOfBirth:   string;
    allergies:     string[];
    medicalHistory: string;
  };
  aiAnalysis: {
    aiSummary:           string;
    suggestedDiagnosis:  string;
    suggestedMedication: Medication[];
    confidenceScore:     number;
    warnings:            string[];
    report: {
      description: string;
      symptoms:    string[];
      signedUrl:   string;
      fileName:    string;
    };
  };
}

// ── Medication Editor ──────────────────────────────────────────────
function MedicationEditor({
  medications, onChange,
}: {
  medications: Medication[];
  onChange: (meds: Medication[]) => void;
}) {
  const update = (index: number, field: keyof Medication, value: any) => {
    const updated = medications.map((m, i) => i === index ? { ...m, [field]: value } : m);
    onChange(updated);
  };

  const remove = (index: number) => onChange(medications.filter((_, i) => i !== index));

  return (
    <div className="space-y-4">
      {medications.map((med, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Pill size={16} className="text-teal-600" />
              <span className="font-semibold text-navy-900 text-sm">Medication {i + 1}</span>
            </div>
            <button
              onClick={() => remove(i)}
              className="text-red-400 hover:text-red-600 text-xs"
            >
              Remove
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Drug Name</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={med.name}
                onChange={(e) => update(i, 'name', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Dosage</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={med.dosageGuidance}
                onChange={(e) => update(i, 'dosageGuidance', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Frequency</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={med.frequency}
                onChange={(e) => update(i, 'frequency', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Duration</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={med.duration}
                onChange={(e) => update(i, 'duration', e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="text-xs text-gray-500 mb-1 block">Clinical Reasoning (AI suggestion)</label>
            <p className="text-xs text-gray-600 bg-blue-50 rounded-lg p-2 border border-blue-100">
              {med.reasoning}
            </p>
          </div>

          {med.contraindications?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {med.contraindications.map((c, ci) => (
                <span key={ci} className="text-xs bg-red-50 text-red-700 border border-red-100 rounded-full px-2 py-0.5">
                  ⚠ {c}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function CaseReviewPage() {
  const { id }     = useParams<{ id: string }>();
  const router     = useRouter();
  const queryClient = useQueryClient();

  const [doctorNotes, setDoctorNotes]   = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [medications, setMedications]   = useState<Medication[]>([]);
  const [showReject, setShowReject]     = useState(false);

  const { data: caseData, isLoading } = useQuery<CaseDetail>({
    queryKey: ['case', id],
    queryFn: async () => {
      const res = await api.get(`/doctor/pending-cases`);
      return res.data.find((c: CaseDetail) => c.id === id);
    },
    onSuccess: (data) => {
      if (data?.aiAnalysis?.suggestedMedication) {
        setMedications(data.aiAnalysis.suggestedMedication);
      }
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/doctor/prescriptions/${id}/approve`, {
      medications,
      notes:      doctorNotes,
      validDays:  30,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-cases'] });
      router.push('/doctor/cases');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/doctor/prescriptions/${id}/reject`, {
      reason: rejectReason,
      notes:  doctorNotes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-cases'] });
      router.push('/doctor/cases');
    },
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading case...</div>;
  if (!caseData) return <div className="p-8 text-center text-red-500">Case not found</div>;

  const { patient, aiAnalysis } = caseData;
  const confidence = Math.round((aiAnalysis.confidenceScore || 0) * 100);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Case Review</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI analysis complete — your clinical judgment determines the final prescription
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowReject(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium"
          >
            <XCircle size={16} /> Reject
          </button>
          <button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending || medications.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm font-medium disabled:opacity-50"
          >
            <CheckCircle size={16} />
            {approveMutation.isPending ? 'Approving...' : 'Approve Prescription'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Left: Patient + Report */}
        <div className="col-span-1 space-y-4">

          {/* Patient Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <User size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">{patient.user.name}</p>
                <p className="text-xs text-gray-500">{patient.user.email}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {patient.dateOfBirth && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Age</span>
                  <span>{Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 3.156e10)} yrs</span>
                </div>
              )}
              {patient.allergies?.length > 0 && (
                <div>
                  <span className="text-gray-500 text-xs">Known Allergies</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patient.allergies.map((a) => (
                      <span key={a} className="text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2 py-0.5">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Report */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={16} className="text-gray-400" />
              <span className="font-semibold text-sm">Patient Report</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">{aiAnalysis.report.description}</p>
            {aiAnalysis.report.symptoms?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {aiAnalysis.report.symptoms.map((s) => (
                  <span key={s} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{s}</span>
                ))}
              </div>
            )}
            {aiAnalysis.report.signedUrl && (
              <a
                href={aiAnalysis.report.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <FileText size={12} /> View {aiAnalysis.report.fileName}
              </a>
            )}
          </div>
        </div>

        {/* Middle + Right: AI Analysis + Medication Editor */}
        <div className="col-span-2 space-y-4">

          {/* AI Summary */}
          <div className="bg-white rounded-xl border border-blue-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Brain size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">AI Clinical Summary</p>
                  <p className="text-xs text-gray-500">Advisory only — your judgment is final</p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-bold ${confidence >= 70 ? 'text-teal-600' : confidence >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  {confidence}% confidence
                </div>
                <div className="text-xs text-gray-400">data completeness</div>
              </div>
            </div>

            <p className="text-sm text-gray-700 leading-relaxed mb-4">{aiAnalysis.aiSummary}</p>

            {aiAnalysis.warnings?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800 mb-1">Flags & Warnings</p>
                  <ul className="text-xs text-amber-700 space-y-0.5">
                    {aiAnalysis.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Medication Review */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Medications — Review & Modify</h3>
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                AI-suggested · edit before approving
              </span>
            </div>
            <MedicationEditor medications={medications} onChange={setMedications} />
          </div>

          {/* Doctor Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="text-sm font-semibold block mb-2">Doctor Notes (optional)</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              rows={3}
              placeholder="Add notes for the patient or pharmacy..."
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showReject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-lg mb-2">Reject Prescription</h3>
            <p className="text-sm text-gray-500 mb-4">
              Please provide a clear reason so the patient understands next steps.
            </p>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
              rows={4}
              placeholder="Reason for rejection (minimum 10 characters)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowReject(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate()}
                disabled={rejectReason.length < 10 || rejectMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
