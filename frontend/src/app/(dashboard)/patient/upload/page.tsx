'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

const SYMPTOMS = ['Fever','Headache','Cough','Fatigue','Chest Pain','Shortness of Breath','Nausea','Dizziness','Joint Pain','Skin Rash','Abdominal Pain','Back Pain','Sore Throat','Loss of Appetite','Insomnia'];

export default function UploadPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [drag, setDrag] = useState(false);

  const toggleSymptom = (s: string) =>
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async () => {
    if (!description) { setError('Please describe your symptoms'); return; }
    setLoading(true); setError('');
    try {
      const formData = new FormData();
      if (file) formData.append('report', file);
      formData.append('description', description);
      formData.append('symptoms', JSON.stringify(symptoms));
      const res = await fetch('https://veramed.onrender.com/api/patient/upload-report', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setSuccess(true);
      setTimeout(() => router.push('/patient'), 3000);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', background: 'white', borderRadius: '24px', padding: '60px 48px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: '440px' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px' }}>✅</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0B1F3A', marginBottom: '10px' }}>Report Submitted!</h2>
        <p style={{ color: '#6B7280', fontSize: '14px', lineHeight: 1.6, marginBottom: '8px' }}>Your report is being analysed by our AI. A licensed doctor will review the results and issue a prescription if appropriate.</p>
        <p style={{ color: '#3CBEA0', fontSize: '13px', fontWeight: '500' }}>Redirecting to dashboard...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); * { font-family: "DM Sans", sans-serif; box-sizing: border-box; }`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '36px 40px 60px' }}>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 6px' }}>Upload Medical Report</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: 0 }}>AI-assisted analysis • Doctor-reviewed • Fully encrypted</p>
      </div>

      <div style={{ maxWidth: '720px', margin: '-30px auto 0', padding: '0 24px 48px' }}>

        {/* Progress */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '20px 28px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '0' }}>
          {['Upload File', 'Describe Symptoms', 'Review & Submit'].map((label, i) => {
            const n = i + 1;
            const active = step === n; const done = step > n;
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', background: done ? '#3CBEA0' : active ? '#0B1F3A' : '#E5E7EB', color: done || active ? 'white' : '#9CA3AF', flexShrink: 0 }}>
                    {done ? '✓' : n}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: active ? '#0B1F3A' : done ? '#3CBEA0' : '#9CA3AF', whiteSpace: 'nowrap' }}>{label}</span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: '2px', background: done ? '#3CBEA0' : '#E5E7EB', margin: '0 12px' }} />}
              </div>
            );
          })}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Upload Your Report</h2>
            <p style={{ color: '#6B7280', fontSize: '13px', marginBottom: '24px' }}>PDF, JPG, PNG or WEBP • Max 20MB • Optional but recommended</p>
            <div
              onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onClick={() => document.getElementById('file-input')?.click()}
              style={{ border: `2px dashed ${drag ? '#3CBEA0' : file ? '#3CBEA0' : '#D1D5DB'}`, borderRadius: '16px', padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: drag ? '#F0FDF4' : file ? '#F0FDF4' : '#FAFAFA', transition: 'all 0.2s' }}>
              <input id="file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>{file ? '📄' : '📤'}</div>
              {file ? (
                <div>
                  <p style={{ fontSize: '15px', fontWeight: '600', color: '#15803D', marginBottom: '4px' }}>{file.name}</p>
                  <p style={{ fontSize: '12px', color: '#6B7280' }}>{(file.size / 1024 / 1024).toFixed(2)} MB • Click to change</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Drag & drop your report here</p>
                  <p style={{ fontSize: '13px', color: '#9CA3AF' }}>or click to browse files</p>
                </div>
              )}
            </div>
            <div style={{ marginTop: '16px', padding: '12px 16px', background: '#FFFBEB', borderRadius: '10px', border: '1px solid #FCD34D', fontSize: '12px', color: '#92400E' }}>
              ⚠️ No file? No problem — you can describe your symptoms in the next step without uploading a document.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setStep(2)} style={{ padding: '12px 32px', background: '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Describe Your Symptoms</h2>
            <p style={{ color: '#6B7280', fontSize: '13px', marginBottom: '24px' }}>Be as detailed as possible — include duration, severity, and anything that makes it better or worse</p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Select all symptoms that apply</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {SYMPTOMS.map(s => (
                  <button key={s} type="button" onClick={() => toggleSymptom(s)} style={{ padding: '7px 14px', borderRadius: '20px', border: '1px solid', fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', borderColor: symptoms.includes(s) ? '#3CBEA0' : '#E5E7EB', background: symptoms.includes(s) ? '#F0FDF4' : 'white', color: symptoms.includes(s) ? '#15803D' : '#6B7280', fontWeight: symptoms.includes(s) ? '600' : '400' }}>
                    {symptoms.includes(s) ? '✓ ' : ''}{s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Describe in your own words *</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={5}
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', resize: 'none', outline: 'none', lineHeight: 1.6 }}
                placeholder="e.g. I have had a persistent headache for 3 days with fever reaching 38.5°C. The pain is worse in the morning and paracetamol only helps for a few hours..." />
              <div style={{ textAlign: 'right', fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>{description.length} characters</div>
            </div>

            {error && <p style={{ color: '#DC2626', fontSize: '13px', marginBottom: '16px', padding: '10px 14px', background: '#FEF2F2', borderRadius: '8px' }}>⚠ {error}</p>}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(1)} style={{ padding: '12px 24px', background: 'white', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: '12px', fontSize: '14px', cursor: 'pointer' }}>← Back</button>
              <button onClick={() => { if (!description) { setError('Please describe your symptoms'); return; } setError(''); setStep(3); }} style={{ padding: '12px 32px', background: '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                Review →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0B1F3A', marginBottom: '20px' }}>Review & Submit</h2>

            <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '16px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>File</p>
                <p style={{ fontSize: '14px', color: '#111827', fontWeight: '500' }}>{file ? `📄 ${file.name}` : '⚠️ No file uploaded (description only)'}</p>
              </div>
              <div style={{ padding: '16px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Symptoms Selected</p>
                {symptoms.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {symptoms.map(s => <span key={s} style={{ fontSize: '12px', background: '#DCFCE7', color: '#15803D', padding: '3px 10px', borderRadius: '20px', fontWeight: '500' }}>{s}</span>)}
                  </div>
                ) : <p style={{ fontSize: '13px', color: '#9CA3AF' }}>None selected</p>}
              </div>
              <div style={{ padding: '16px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Description</p>
                <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>{description}</p>
              </div>
            </div>

            <div style={{ padding: '14px 18px', background: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE', marginBottom: '24px', fontSize: '13px', color: '#1D4ED8', lineHeight: 1.6 }}>
              🔒 Your data is encrypted end-to-end. AI analysis is advisory only — a licensed doctor reviews all suggestions before any prescription is issued.
            </div>

            {error && <p style={{ color: '#DC2626', fontSize: '13px', marginBottom: '16px', padding: '10px 14px', background: '#FEF2F2', borderRadius: '8px' }}>⚠ {error}</p>}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(2)} style={{ padding: '12px 24px', background: 'white', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: '12px', fontSize: '14px', cursor: 'pointer' }}>← Back</button>
              <button onClick={handleSubmit} disabled={loading} style={{ padding: '12px 36px', background: loading ? '#9CA3AF' : '#3CBEA0', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? '⏳ Submitting...' : '🚀 Submit Report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
