'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import {
  Upload, FileText, X, CheckCircle2, AlertCircle,
  Brain, Shield, Clock, ChevronRight,
} from 'lucide-react';

const SYMPTOM_OPTIONS = [
  'Fever', 'Headache', 'Cough', 'Fatigue', 'Chest Pain',
  'Shortness of Breath', 'Nausea', 'Dizziness', 'Joint Pain',
  'Skin Rash', 'Abdominal Pain', 'Back Pain', 'Insomnia', 'Other',
];

interface UploadedFile {
  file:     File;
  preview?: string;
}

export default function UploadReportPage() {
  const router       = useRouter();
  const queryClient  = useQueryClient();

  const [uploadedFile, setUploadedFile]   = useState<UploadedFile | null>(null);
  const [description, setDescription]     = useState('');
  const [selectedSymptoms, setSelected]   = useState<string[]>([]);
  const [step, setStep]                   = useState<'upload' | 'describe' | 'confirm'>('upload');

  const toggleSymptom = (s: string) =>
    setSelected((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setUploadedFile({ file, preview });
    setStep('describe');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('report',       uploadedFile!.file);
      formData.append('description',  description);
      formData.append('symptoms',     JSON.stringify(selectedSymptoms));

      const res = await api.post('/patient/upload-report', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      router.push('/patient/reports');
    },
  });

  const sizeLabel = uploadedFile
    ? uploadedFile.file.size > 1024 * 1024
      ? `${(uploadedFile.file.size / 1024 / 1024).toFixed(1)} MB`
      : `${Math.round(uploadedFile.file.size / 1024)} KB`
    : '';

  return (
    <div className="max-w-3xl mx-auto p-6">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Upload Medical Report</h1>
        <p className="text-gray-500 text-sm">
          Upload your diagnosis, lab results, or describe your symptoms. Our AI will prepare a
          clinical summary for your assigned doctor to review.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {(['upload', 'describe', 'confirm'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 text-sm font-medium ${
              step === s ? 'text-navy-900' : s < step ? 'text-mint-600' : 'text-gray-400'
            }`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                s < step
                  ? 'bg-mint-500 text-white'
                  : step === s
                  ? 'bg-navy-900 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {s < step ? '✓' : i + 1}
              </div>
              <span className="hidden sm:inline capitalize">{s}</span>
            </div>
            {i < 2 && <ChevronRight size={14} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: File Upload ── */}
      {step === 'upload' && (
        <div>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-mint-400 bg-mint-50'
                : 'border-gray-200 hover:border-mint-300 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 rounded-2xl bg-navy-50 flex items-center justify-center mx-auto mb-4">
              <Upload size={28} className="text-navy-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              {isDragActive ? 'Drop your file here' : 'Drag & drop your report'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">or click to browse files</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {['PDF', 'JPEG', 'PNG', 'WEBP'].map((t) => (
                <span key={t} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1">{t}</span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">Maximum file size: 20MB</p>
          </div>

          {/* Trust indicators */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { icon: Shield, label: 'End-to-end encrypted', color: 'text-blue-600', bg: 'bg-blue-50' },
              { icon: Brain,  label: 'AI-assisted analysis', color: 'text-purple-600', bg: 'bg-purple-50' },
              { icon: Clock,  label: 'Doctor reviews within 24h', color: 'text-mint-600', bg: 'bg-mint-50' },
            ].map(({ icon: Icon, label, color, bg }) => (
              <div key={label} className={`flex items-center gap-2 p-3 rounded-xl ${bg}`}>
                <Icon size={16} className={color} />
                <span className={`text-xs font-medium ${color}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Describe ── */}
      {step === 'describe' && uploadedFile && (
        <div className="space-y-6">
          {/* File preview */}
          <div className="flex items-center gap-3 p-4 bg-mint-50 border border-mint-100 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-mint-100 flex items-center justify-center">
              {uploadedFile.preview
                ? <img src={uploadedFile.preview} className="w-10 h-10 rounded-lg object-cover" alt="" />
                : <FileText size={20} className="text-mint-600" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{uploadedFile.file.name}</p>
              <p className="text-xs text-gray-500">{sizeLabel}</p>
            </div>
            <button onClick={() => { setUploadedFile(null); setStep('upload'); }}>
              <X size={16} className="text-gray-400 hover:text-red-500" />
            </button>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Describe your concern <span className="text-red-400">*</span>
            </label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-mint-400 resize-none"
              rows={5}
              placeholder="Describe your symptoms, how long you've had them, and any relevant medical context. The more detail you provide, the better the AI can assist your doctor."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">{description.length}/1000 characters</p>
          </div>

          {/* Symptoms */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Select symptoms (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSymptom(s)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                    selectedSymptoms.includes(s)
                      ? 'border-mint-400 bg-mint-50 text-mint-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep('upload')}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={description.trim().length < 10}
              className="px-6 py-2.5 bg-navy-900 text-white rounded-xl text-sm font-medium hover:bg-navy-800 disabled:opacity-40 transition-all"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm & Submit ── */}
      {step === 'confirm' && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Important Notice</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                AI analysis is for clinical support only and is reviewed by a licensed doctor
                before any prescription is issued. This is NOT an emergency service.
                If you are in immediate danger, call 999.
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-sm text-gray-900">Submission Summary</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-400 w-24 flex-shrink-0">File</span>
                <span className="text-gray-900 font-medium">{uploadedFile?.file.name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-24 flex-shrink-0">Description</span>
                <span className="text-gray-700">{description}</span>
              </div>
              {selectedSymptoms.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-gray-400 w-24 flex-shrink-0">Symptoms</span>
                  <span className="text-gray-700">{selectedSymptoms.join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          {uploadMutation.isSuccess && (
            <div className="flex items-center gap-2 text-mint-600 text-sm font-medium">
              <CheckCircle2 size={18} />
              Report submitted! Redirecting to your reports...
            </div>
          )}

          {uploadMutation.isError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={18} />
              Upload failed. Please try again.
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep('describe')} className="px-4 py-2 text-sm text-gray-500">← Back</button>
            <button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending}
              className="px-7 py-2.5 bg-mint-500 text-white rounded-xl text-sm font-semibold hover:bg-mint-600 disabled:opacity-50 flex items-center gap-2 transition-all"
            >
              {uploadMutation.isPending
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
                : <><Upload size={16} /> Submit Report</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
