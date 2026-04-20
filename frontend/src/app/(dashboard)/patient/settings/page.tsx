'use client';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
const API = process.env.NEXT_PUBLIC_API_URL || 'https://veramed.onrender.com';
const COUNTRIES = ['Bangladesh','Pakistan','India','Sri Lanka','Nepal','Bhutan','Maldives','Afghanistan'];
export default function PatientSettings() {
  const { accessToken, user } = useAuthStore();
  const [form, setForm] = useState({ street: '', city: '', postcode: '', country: 'Bangladesh', phone: '', dateOfBirth: '', gender: '', allergies: '' });
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [coords, setCoords] = useState<{lat:number;lng:number}|null>(null);

  useEffect(() => {
    fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + accessToken } })
      .then(r => r.json()).then(d => {
        if (d.patient?.address) setForm(f => ({ ...f, ...d.patient.address }));
        if (d.phone) setForm(f => ({ ...f, phone: d.phone }));
        if (d.patient?.dateOfBirth) setForm(f => ({ ...f, dateOfBirth: d.patient.dateOfBirth.split('T')[0] }));
        if (d.patient?.gender) setForm(f => ({ ...f, gender: d.patient.gender }));
        if (d.patient?.allergies) setForm(f => ({ ...f, allergies: d.patient.allergies.join(', ') }));
        if (d.patient?.lat && d.patient?.lng) setCoords({ lat: d.patient.lat, lng: d.patient.lng });
      });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      setGeocoding(true);
      const geoRes = await fetch(API + '/api/patient/update-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
        body: JSON.stringify({
          address: form,
          phone: form.phone,
          dateOfBirth: form.dateOfBirth || null,
          gender: form.gender || null,
          allergies: form.allergies ? form.allergies.split(',').map((a: string) => a.trim()).filter(Boolean) : [],
        }),
      });
      const data = await geoRes.json();
      if (!geoRes.ok) throw new Error(data.error || 'Failed to save');
      if (data.coords) setCoords(data.coords);
      setSuccess('Profile updated successfully!');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); setGeocoding(false); }
  };

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div style={{ padding: '32px', maxWidth: '600px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0F172A', marginBottom: '6px' }}>My Profile</h1>
      <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '28px' }}>Keep your address up to date so we can calculate accurate delivery fees</p>
      <form onSubmit={save}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #F1F5F9', marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personal Information</p>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Phone Number</label>
            <input value={form.phone} onChange={e => f('phone', e.target.value)} placeholder='+880 1234 567890'
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Date of Birth <span style={{ color: '#DC2626' }}>*</span></label>
            <input type='date' value={form.dateOfBirth} onChange={e => f('dateOfBirth', e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
            <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>Required so AI can calculate your exact age for accurate analysis</p>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Gender</label>
            <select value={form.gender} onChange={e => f('gender', e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box', background: 'white' }}>
              <option value=''>Select gender</option>
              <option value='male'>Male</option>
              <option value='female'>Female</option>
              <option value='other'>Other</option>
              <option value='prefer_not_to_say'>Prefer not to say</option>
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Known Allergies</label>
            <input value={form.allergies} onChange={e => f('allergies', e.target.value)} placeholder='e.g. Penicillin, Pollen, Nuts (comma separated)'
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
            <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>AI will flag medication conflicts with your allergies</p>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #F1F5F9', marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery Address</p>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Street Address</label>
            <input value={form.street} onChange={e => f('street', e.target.value)} placeholder='123 Main Road'
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>City</label>
              <input value={form.city} onChange={e => f('city', e.target.value)} placeholder='Dhaka'
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Postcode</label>
              <input value={form.postcode} onChange={e => f('postcode', e.target.value)} placeholder='1207'
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Country</label>
            <select value={form.country} onChange={e => f('country', e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box', background: 'white' }}>
              {COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {coords && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#065F46' }}>
            ✓ Location detected: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </div>
        )}
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '12px', marginBottom: '14px', fontSize: '13px', color: '#991B1B' }}>❌ {error}</div>}
        {success && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px', marginBottom: '14px', fontSize: '13px', color: '#065F46' }}>✅ {success}</div>}
        <button type='submit' disabled={loading}
          style={{ width: '100%', padding: '13px', background: loading ? '#94A3B8' : '#0F172A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {geocoding ? '📍 Detecting location...' : loading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}