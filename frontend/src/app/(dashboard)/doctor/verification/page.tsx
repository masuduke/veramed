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
  const { accessToken } = useAuthStore();
  const [uploads, setUploads] = useState<Record<string, File>>({});
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/doctor/verification-status').then(r => {
      setVerificationStatus(r.data?.status || 'unverified');
      if (r.data?.status === 'pending') setSubmitted(true);
      if (r.data?.rejectionReason) setRejectionReason(r.data.rejectionReason);
    }).catch(() => {});
  }, []);
  const handleFileSelect = (key: string, file: File | null) => {
    if (!file) return;
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) { setError('Invalid file type. Please upload PDF, JPG, PNG or WEBP.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('File too large. Maximum size is 10MB.'); return; }
    setError('');
    setUploads(prev => ({ ...prev, [key]: file }));
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
      const res = await fetch('https://veramed.onrender.com/api/doctor/submit-verification', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setSubmitted(true);
      setVerificationStatus('pending');
      setRejectionReason('');
    } catch (err) {
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
  if (submitted && !rejectionReason) return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '48px', textAlign: 'center', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>⏳</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0B1F3A', marginBottom: '8px' }}>Documents Under Review</h2>
        <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '16px', lineHeight: 1.6 }}>Your documents have been submitted and are being reviewed by our admin team. Usually within 24 hours.</p>
      </div>
    </div>
  );
  if (rejectionReason) return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '48px', textAlign: 'center', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>❌</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#DC2626', marginBottom: '8px' }}>Documents Rejected</h2>
        <div style={{ padding: '14px', background: '#FEE2E2', borderRadius: '12px', border: '1px solid #FECACA', marginBottom: '24px', textAlign: 'left' }}>
          <p style={{ fontSize: '13px', fontWeight: '700', color: '#DC2626', margin: '0 0 4px' }}>Reason from admin:</p>
          <p style={{ fontSize: '13px', color: '#991B1B', margin: 0 }}>{rejectionReason}</p>
        </div>
        <button onClick={() => { setSubmitted(false); setRejectionReason(''); setUploads({}); }}
          style={{ padding: '12px 28px', background: '#DC2626', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
          Re-upload Documents
        </button>
      </div>
    </div>
  );
  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif', padding: '40px 24px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: '24px', padding: '36px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0B1F3A', marginBottom: '8px' }}>Verification Documents</h1>
          <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '28px', lineHeight: 1.6 }}>Upload your documents so admin can verify your account before you can approve prescriptions.</p>
          {error && <div style={{ padding: '12px', background: '#FEE2E2', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', color: '#DC2626' }}>{error}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {REQUIRED_DOCS.map(doc => (
              <div key={doc.key} style={{ border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#0B1F3A', margin: '0 0 2px' }}>
                      {doc.label} {doc.required && <span style={{ color: '#DC2626' }}>*</span>}
                    </p>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{doc.description}</p>
                    {uploads[doc.key] && <p style={{ fontSize: '11px', color: '#3CBEA0', margin: '4px 0 0', fontWeight: '600' }}>✓ {uploads[doc.key].name}</p>}
                  </div>
                  <label style={{ cursor: 'pointer', padding: '8px 16px', background: uploads[doc.key] ? '#DCFCE7' : '#EEF2FF', color: uploads[doc.key] ? '#15803D' : '#4338CA', borderRadius: '8px', fontSize: '12px', fontWeight: '600', marginLeft: '12px', flexShrink: 0 }}>
                    {uploads[doc.key] ? '✓ Change' : 'Upload'}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                      onChange={e => handleFileSelect(doc.key, e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button onClick={handleSubmit} disabled={uploading || !requiredComplete}
            style={{ width: '100%', padding: '14px', background: !requiredComplete ? '#9CA3AF' : '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: !requiredComplete ? 'not-allowed' : 'pointer' }}>
            {uploading ? 'Uploading...' : 'Submit for Verification'}
          </button>
        </div>
      </div>
    </div>
  );
}