'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api-client';

const VEHICLE_TYPES = [
  { value: 'car', label: 'Car', icon: '🚗', requiresLicense: true },
  { value: 'motorcycle', label: 'Motorcycle', icon: '🏍️', requiresLicense: true },
  { value: 'van', label: 'Van', icon: '🚐', requiresLicense: true },
  { value: 'bicycle', label: 'Bicycle', icon: '🚲', requiresLicense: false },
  { value: 'e_bicycle', label: 'E-Bicycle', icon: '⚡🚲', requiresLicense: false },
  { value: 'scooter', label: 'Electric Scooter', icon: '🛴', requiresLicense: false },
];

export default function DriverVerificationPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [vehicleType, setVehicleType] = useState('');
  const [uploads, setUploads] = useState<Record<string, File | null>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    api.get('/delivery/verification-status').then(r => {
      setVerificationStatus(r.data?.status || 'unverified');
      if (r.data?.vehicleType) setVehicleType(r.data.vehicleType);
      if (r.data?.status === 'pending') setSubmitted(true);
    }).catch(() => {});
  }, []);

  const selectedVehicle = VEHICLE_TYPES.find(v => v.value === vehicleType);
  const requiresLicense = selectedVehicle?.requiresLicense ?? true;

  const REQUIRED_DOCS = [
    ...(requiresLicense ? [
      { key: 'driving_license', label: 'Driving License (Front)', required: true, description: 'Clear photo of the front of your valid driving license' },
      { key: 'driving_license_back', label: 'Driving License (Back)', required: true, description: 'Clear photo of the back of your driving license' },
    ] : []),
    { key: 'id_document', label: 'Government-issued Photo ID', required: true, description: 'Passport, driving license or national ID card' },
    { key: 'selfie', label: 'Selfie with ID', required: true, description: 'A clear photo of yourself holding your ID document' },
    ...(vehicleType === 'car' || vehicleType === 'van' ? [
      { key: 'vehicle_insurance', label: 'Vehicle Insurance', required: true, description: 'Current vehicle insurance certificate' },
      { key: 'mot_certificate', label: 'MOT Certificate', required: false, description: 'Current MOT certificate (if applicable)' },
    ] : []),
    ...(vehicleType === 'motorcycle' ? [
      { key: 'vehicle_insurance', label: 'Motorcycle Insurance', required: true, description: 'Current motorcycle insurance certificate' },
    ] : []),
  ];

  const handleFileSelect = (key: string, file: File | null) => {
    if (!file) return;
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) { setError('Please upload PDF, JPG, PNG or WEBP files only.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('File too large. Maximum 10MB.'); return; }
    setError('');
    setUploads(prev => ({ ...prev, [key]: file }));
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setPreviews(prev => ({ ...prev, [key]: e.target?.result as string }));
      reader.readAsDataURL(file);
    } else { setPreviews(prev => ({ ...prev, [key]: 'pdf' })); }
  };

  const requiredComplete = vehicleType && REQUIRED_DOCS.filter(d => d.required).every(d => uploads[d.key]);

  const handleSubmit = async () => {
    if (!requiredComplete) { setError('Please upload all required documents.'); return; }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('vehicleType', vehicleType);
      formData.append('requiresLicense', String(requiresLicense));
      for (const [key, file] of Object.entries(uploads)) {
        if (file) formData.append(key, file);
      }
      await fetch('https://veramed.onrender.com/api/delivery/submit-verification', {
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
        <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>Your documents have been verified. You can now go online and start accepting delivery jobs.</p>
        <button onClick={() => router.push('/driver')} style={{ padding: '12px 28px', background: '#3CBEA0', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Go to Dashboard</button>
      </div>
    </div>
  );

  if (submitted || verificationStatus === 'pending') return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '48px', textAlign: 'center', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>⏳</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0B1F3A', marginBottom: '8px' }}>Documents Under Review</h2>
        <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '16px', lineHeight: 1.6 }}>Your documents are being reviewed by our team. You will be notified once approved — usually within 24 hours.</p>
        <div style={{ padding: '12px 16px', background: selectedVehicle?.requiresLicense === false ? '#F0FDF4' : '#EFF6FF', borderRadius: '12px', marginBottom: '24px', fontSize: '13px', color: selectedVehicle?.requiresLicense === false ? '#15803D' : '#1D4ED8' }}>
          {selectedVehicle?.icon} Vehicle: <strong>{selectedVehicle?.label}</strong>
          {!requiresLicense && ' — No driving license required ✓'}
        </div>
        <button onClick={() => router.push('/driver')} style={{ padding: '12px 28px', background: '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Back to Dashboard</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); *{font-family:"DM Sans",sans-serif;box-sizing:border-box;}`}</style>

      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '36px 40px 60px' }}>
        <p style={{ color: '#3CBEA0', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Driver Verification</p>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 6px' }}>Verify Your Account</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: 0 }}>Required before you can go online and accept delivery jobs</p>
      </div>

      <div style={{ maxWidth: '720px', margin: '-30px auto 0', padding: '0 24px 48px' }}>

        {/* Step 1 — Vehicle selection */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Step 1 — Select your vehicle type</h2>
          <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>This determines which documents you need to upload</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
            {VEHICLE_TYPES.map(v => (
              <button key={v.value} onClick={() => { setVehicleType(v.value); setUploads({}); setPreviews({}); setStep(2); }}
                style={{ padding: '16px 12px', border: `2px solid ${vehicleType === v.value ? '#3CBEA0' : '#E5E7EB'}`, borderRadius: '14px', background: vehicleType === v.value ? '#F0FDF4' : 'white', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>{v.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: vehicleType === v.value ? '#15803D' : '#0B1F3A' }}>{v.label}</div>
                {!v.requiresLicense && (
                  <div style={{ fontSize: '10px', color: '#3CBEA0', marginTop: '4px', fontWeight: '600' }}>No license needed</div>
                )}
              </button>
            ))}
          </div>

          {vehicleType && (
            <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '12px', background: requiresLicense ? '#EFF6FF' : '#F0FDF4', border: `1px solid ${requiresLicense ? '#BFDBFE' : '#BBF7D0'}`, fontSize: '13px', color: requiresLicense ? '#1D4ED8' : '#15803D' }}>
              {requiresLicense
                ? `📋 ${selectedVehicle?.label} requires a valid driving license. Please upload your license documents below.`
                : `✅ Great! ${selectedVehicle?.label} does not require a driving license. Just upload your ID documents below.`}
            </div>
          )}
        </div>

        {/* Step 2 — Document upload */}
        {vehicleType && (
          <>
            <div style={{ background: 'white', borderRadius: '16px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>Step 2 — Upload documents</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#3CBEA0' }}>
                  {REQUIRED_DOCS.filter(d => d.required && uploads[d.key]).length} / {REQUIRED_DOCS.filter(d => d.required).length} required
                </span>
              </div>
              <div style={{ height: '6px', background: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#3CBEA0', borderRadius: '3px', transition: 'width 0.3s', width: `${REQUIRED_DOCS.filter(d => d.required).length > 0 ? (REQUIRED_DOCS.filter(d => d.required && uploads[d.key]).length / REQUIRED_DOCS.filter(d => d.required).length) * 100 : 0}%` }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {REQUIRED_DOCS.map(doc => (
                <div key={doc.key} style={{ background: 'white', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: `1px solid ${uploads[doc.key] ? '#BBF7D0' : '#F3F4F6'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#0B1F3A' }}>{doc.label}</span>
                        <span style={{ fontSize: '10px', background: doc.required ? '#FEE2E2' : '#F3F4F6', color: doc.required ? '#DC2626' : '#6B7280', padding: '2px 6px', borderRadius: '10px', fontWeight: '700' }}>
                          {doc.required ? 'Required' : 'Optional'}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>{doc.description}</p>
                    </div>
                    {uploads[doc.key] && <span style={{ fontSize: '20px', marginLeft: '12px' }}>✅</span>}
                  </div>

                  {uploads[doc.key] ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#F0FDF4', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                      {previews[doc.key] === 'pdf' ? <span style={{ fontSize: '24px' }}>📄</span> : previews[doc.key] ? <img src={previews[doc.key]} alt="" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }} /> : null}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#15803D', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploads[doc.key]?.name}</p>
                      </div>
                      <button onClick={() => { setUploads(p => { const n = {...p}; delete n[doc.key]; return n; }); }} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                    </div>
                  ) : (
                    <label style={{ cursor: 'pointer' }}>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => handleFileSelect(doc.key, e.target.files?.[0] || null)} style={{ display: 'none' }} />
                      <div style={{ border: '2px dashed #D1D5DB', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', marginBottom: '4px' }}>📤</div>
                        <p style={{ fontSize: '12px', fontWeight: '500', color: '#374151', margin: '0 0 2px' }}>Click to upload</p>
                        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>PDF, JPG, PNG • Max 10MB</p>
                      </div>
                    </label>
                  )}
                </div>
              ))}
            </div>

            {error && <div style={{ padding: '12px 16px', background: '#FEE2E2', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', color: '#DC2626' }}>⚠️ {error}</div>}

            <div style={{ padding: '12px 16px', background: '#FFFBEB', borderRadius: '12px', border: '1px solid #FCD34D', marginBottom: '20px', fontSize: '13px', color: '#92400E', lineHeight: 1.6 }}>
              ⚠️ All documents must be valid and belong to you. Fraudulent documents will result in immediate account termination.
            </div>

            <button onClick={handleSubmit} disabled={uploading || !requiredComplete}
              style={{ width: '100%', padding: '14px', background: !requiredComplete ? '#9CA3AF' : uploading ? '#6B7280' : '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: !requiredComplete || uploading ? 'not-allowed' : 'pointer' }}>
              {uploading ? '⏳ Uploading...' : !requiredComplete ? 'Upload all required documents first' : '📨 Submit for Verification'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
