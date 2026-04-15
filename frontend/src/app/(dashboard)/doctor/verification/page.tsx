'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api-client';

const REQUIRED_DOCS = [
  { key: 'medical_license', label: 'Medical License / GMC Registration', required: true, description: 'Your current medical license or GMC registration certificate' },
  { key: 'degree_certificate', label: 'Medical Degree Certificate', required: true, description: 'MBBS, MD or equivalent degree certificate' },
  { key: 'id_document', label: 'Government-issued Photo ID', required: true, description: 'Passport, driving license or national ID card' },
  { key: 'specialty_certificate', label: 'Specialty Certificate', required: false, description: 'Board certification or specialty qualification (if applicable)' },
  { key: 'insurance', label: 'Professional Indemnity Insurance', required: false, description: 'Current professional indemnity insurance certificate' },
];

export default function DoctorVerificationPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [uploads, setUploads] = useState<Record<string, File | null>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check current verification status
    api.get('/doctor/verification-status').then(r => {
      setVerificationStatus(r.data?.status || 'unverified');
      if (r.data?.status === 'pending') setSubmitted(true);
    }).catch(() => {});
  }, []);

  const handleFileSelect = (key: string, file: File | null) => {
    if (!file) return;
    // Validate file type and size
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError(`Invalid file type for ${key}. Please upload PDF, JPG, PNG or WEBP.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(`File too large. Maximum size is 10MB.`);
      return;
    }
    setError('');
    setUploads(prev => ({ ...prev, [key]: file }));
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setPreviews(prev => ({ ...prev, [key]: e.target?.result as string }));
      reader.readAsDataURL(file);
    } else {
      setPreviews(prev => ({ ...prev, [key]: 'pdf' }));
    }
  };

  const requiredComplete = REQUIRED_DOCS.filter(d => d.required).every(d => uploads[d.key]);

  const handleSubmit = async () => {
    if (!requiredComplete) { setError('Please upload all required documents before submitting.'); return; }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      for (const [key, file] of Object.entries(uploads)) {
        if (file) formData.append(key, file);
      }
      formData.append('documentTypes', JSON.stringify(Object.keys(uploads)));
      await fetch('https://veramed.onrender.com/api/doctor/submit-verification', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken },
        body: formData,
      }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Upload failed');
      });
      setSubmitted(true);
      setVerificationStatus('pending');
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally { setUploading(false); }
  };

  if (verificationStatus === 'approved') return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '48px', textAlign: 'center', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0B1F3A', marginBottom: '8px' }}>Verification Approved!</h2>
        <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>Your medical credentials have been verified. You can now review and approve prescriptions.</p>
        <button onClick={() => router.push('/doctor')} style={{ padding: '12px 28px', background: '#3CBEA0', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Go to Dashboard</button>
      </div>
    </div>
  );

  if (submitted || verificationStatus === 'pending') return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '48px', textAlign: 'center', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>⏳</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0B1F3A', marginBottom: '8px' }}>Documents Under Review</h2>
        <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '16px', lineHeight: 1.6 }}>Your documents have been submitted and are being reviewed by our admin team. You will be notified once verified — usually within 24 hours.</p>
        <div style={{ padding: '14px 16px', background: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE', fontSize: '13px', color: '#1D4ED8', marginBottom: '24px' }}>
          💡 You will receive an email notification once your account is verified and you can start reviewing prescriptions.
        </div>
        <button onClick={() => router.push('/doctor')} style={{ padding: '12px 28px', background: '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Back to Dashboard</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); *{font-family:"DM Sans",sans-serif;box-sizing:border-box;}`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '36px 40px 60px' }}>
        <p style={{ color: '#3CBEA0', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Doctor Verification</p>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 6px' }}>Upload Your Credentials</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: 0 }}>Required before you can review and approve prescriptions on VeraMed</p>
      </div>

      <div style={{ maxWidth: '720px', margin: '-30px auto 0', padding: '0 24px 48px' }}>

        {/* Progress */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>Required documents uploaded</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#3CBEA0' }}>
              {REQUIRED_DOCS.filter(d => d.required && uploads[d.key]).length} / {REQUIRED_DOCS.filter(d => d.required).length}
            </span>
          </div>
          <div style={{ height: '6px', background: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#3CBEA0', borderRadius: '3px', transition: 'width 0.3s', width: `${(REQUIRED_DOCS.filter(d => d.required && uploads[d.key]).length / REQUIRED_DOCS.filter(d => d.required).length) * 100}%` }} />
          </div>
        </div>

        {/* Info banner */}
        <div style={{ padding: '14px 18px', background: '#EFF6FF', borderRadius: '14px', border: '1px solid #BFDBFE', marginBottom: '20px', fontSize: '13px', color: '#1D4ED8', lineHeight: 1.6 }}>
          🔒 All documents are encrypted and stored securely. They are only accessible to VeraMed admin staff for verification purposes and will never be shared with patients.
        </div>

        {/* Document upload cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          {REQUIRED_DOCS.map(doc => (
            <div key={doc.key} style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: `1px solid ${uploads[doc.key] ? '#BBF7D0' : '#F3F4F6'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#0B1F3A' }}>{doc.label}</span>
                    {doc.required ? (
                      <span style={{ fontSize: '10px', background: '#FEE2E2', color: '#DC2626', padding: '2px 6px', borderRadius: '10px', fontWeight: '700' }}>Required</span>
                    ) : (
                      <span style={{ fontSize: '10px', background: '#F3F4F6', color: '#6B7280', padding: '2px 6px', borderRadius: '10px', fontWeight: '600' }}>Optional</span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>{doc.description}</p>
                </div>
                {uploads[doc.key] && (
                  <span style={{ fontSize: '20px', marginLeft: '12px', flexShrink: 0 }}>✅</span>
                )}
              </div>

              {uploads[doc.key] ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#F0FDF4', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                  {previews[doc.key] === 'pdf' ? (
                    <div style={{ width: '40px', height: '40px', background: '#DCFCE7', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>📄</div>
                  ) : previews[doc.key] ? (
                    <img src={previews[doc.key]} alt="preview" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                  ) : null}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#15803D', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploads[doc.key]?.name}</p>
                    <p style={{ fontSize: '11px', color: '#6B7280', margin: 0 }}>{((uploads[doc.key]?.size || 0) / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button onClick={() => { setUploads(prev => { const n = {...prev}; delete n[doc.key]; return n; }); setPreviews(prev => { const n = {...prev}; delete n[doc.key]; return n; }); }}
                    style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '18px', flexShrink: 0 }}>✕</button>
                </div>
              ) : (
                <label style={{ display: 'block', cursor: 'pointer' }}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => handleFileSelect(doc.key, e.target.files?.[0] || null)} style={{ display: 'none' }} />
                  <div style={{ border: '2px dashed #D1D5DB', borderRadius: '10px', padding: '20px', textAlign: 'center', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: '28px', marginBottom: '6px' }}>📤</div>
                    <p style={{ fontSize: '13px', fontWeight: '500', color: '#374151', margin: '0 0 4px' }}>Click to upload or drag & drop</p>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>PDF, JPG, PNG or WEBP • Max 10MB</p>
                  </div>
                </label>
              )}
            </div>
          ))}
        </div>

        {error && <div style={{ padding: '12px 16px', background: '#FEE2E2', borderRadius: '10px', border: '1px solid #FECACA', marginBottom: '16px', fontSize: '13px', color: '#DC2626' }}>⚠️ {error}</div>}

        <div style={{ padding: '14px 18px', background: '#FFFBEB', borderRadius: '12px', border: '1px solid #FCD34D', marginBottom: '20px', fontSize: '13px', color: '#92400E', lineHeight: 1.6 }}>
          ⚠️ By submitting, you confirm that all uploaded documents are genuine and belong to you. False documentation may result in permanent account suspension and legal action.
        </div>

        <button onClick={handleSubmit} disabled={uploading || !requiredComplete}
          style={{ width: '100%', padding: '14px', background: !requiredComplete ? '#9CA3AF' : uploading ? '#6B7280' : '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: !requiredComplete || uploading ? 'not-allowed' : 'pointer' }}>
          {uploading ? '⏳ Uploading documents...' : !requiredComplete ? `Upload ${REQUIRED_DOCS.filter(d => d.required && !uploads[d.key]).length} more required document(s)` : '📨 Submit for Verification'}
        </button>
      </div>
    </div>
  );
}
