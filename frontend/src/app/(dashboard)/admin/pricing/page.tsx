'use client';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
const API = process.env.NEXT_PUBLIC_API_URL || 'https://veramed.onrender.com';
const COUNTRIES = [
  { code: 'BD', name: 'Bangladesh', currency_code: 'BDT', currency_symbol: '৳' },
  { code: 'PK', name: 'Pakistan', currency_code: 'PKR', currency_symbol: '₨' },
  { code: 'IN', name: 'India', currency_code: 'INR', currency_symbol: '₹' },
  { code: 'LK', name: 'Sri Lanka', currency_code: 'LKR', currency_symbol: 'Rs' },
  { code: 'NP', name: 'Nepal', currency_code: 'NPR', currency_symbol: 'रू' },
  { code: 'BT', name: 'Bhutan', currency_code: 'BTN', currency_symbol: 'Nu' },
  { code: 'MV', name: 'Maldives', currency_code: 'MVR', currency_symbol: 'Rf' },
  { code: 'AF', name: 'Afghanistan', currency_code: 'AFN', currency_symbol: '؋' },
];
const EMPTY = { country_code: '', country_name: '', currency_code: '', currency_symbol: '', patient_fee: '', pharmacy_pct: '', driver_pct: '', doctor_fee: '', free_km: '3', per_km_fee: '' };
export default function AdminPricingPage() {
  const { accessToken } = useAuthStore();
  const [pricing, setPricing] = useState<any[]>([]);
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken };

  const load = () => fetch(API + '/api/pricing/all', { headers }).then(r => r.json()).then(d => setPricing(Array.isArray(d) ? d : []));
  useEffect(() => { load(); }, []);

  const selectCountry = (code: string) => {
    const c = COUNTRIES.find(x => x.code === code);
    if (c) setForm((f: any) => ({ ...f, country_code: c.code, country_name: c.name, currency_code: c.currency_code, currency_symbol: c.currency_symbol }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      const res = await fetch(API + '/api/pricing/country', { method: 'POST', headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg('✅ Saved successfully'); setForm(EMPTY); setEditing(false); load();
    } catch (err: any) { setMsg('❌ ' + err.message); }
    finally { setSaving(false); }
  };

  const toggle = async (code: string) => {
    await fetch(API + '/api/pricing/country/' + code + '/toggle', { method: 'PATCH', headers });
    load();
  };

  const edit = (p: any) => {
    setForm({ country_code: p.country_code, country_name: p.country_name, currency_code: p.currency_code, currency_symbol: p.currency_symbol, patient_fee: p.patient_fee, pharmacy_pct: p.pharmacy_pct, driver_pct: p.driver_pct, doctor_fee: p.doctor_fee, free_km: p.free_km, per_km_fee: p.per_km_fee });
    setEditing(true);
  };

  const del = async (code: string) => {
    if (!confirm('Delete ' + code + ' pricing?')) return;
    await fetch(API + '/api/pricing/country/' + code, { method: 'DELETE', headers });
    load();
  };

  const f = (k: string, v: string) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Country Pricing</h1>
          <p style={{ color: '#64748B', fontSize: '14px', margin: '4px 0 0' }}>Set fees and commissions per country. Only active countries are accessible to users.</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setEditing(true); }} style={{ padding: '10px 20px', background: '#0F172A', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>+ Add Country</button>
      </div>

      {editing && (
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '20px' }}>{form.country_code ? 'Edit ' + form.country_name : 'Add Country Pricing'}</h3>
          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Country</label>
                <select value={form.country_code} onChange={e => selectCountry(e.target.value)} required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', background: 'white', boxSizing: 'border-box' }}>
                  <option value=''>Select country...</option>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.currency_code})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Currency Symbol</label>
                <input value={form.currency_symbol} onChange={e => f('currency_symbol', e.target.value)} placeholder='৳'
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Patient Service Fee</label>
                <input type='number' value={form.patient_fee} onChange={e => f('patient_fee', e.target.value)} placeholder='60' required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Pharmacy Commission %</label>
                <input type='number' value={form.pharmacy_pct} onChange={e => f('pharmacy_pct', e.target.value)} placeholder='8' required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Driver Commission %</label>
                <input type='number' value={form.driver_pct} onChange={e => f('driver_pct', e.target.value)} placeholder='12' required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Doctor Fee per Rx</label>
                <input type='number' value={form.doctor_fee} onChange={e => f('doctor_fee', e.target.value)} placeholder='200' required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Free Delivery Radius (km)</label>
                <input type='number' value={form.free_km} onChange={e => f('free_km', e.target.value)} placeholder='3' required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Fee per km beyond free radius</label>
                <input type='number' value={form.per_km_fee} onChange={e => f('per_km_fee', e.target.value)} placeholder='15' required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            </div>
            {msg && <div style={{ padding: '10px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px', background: msg.startsWith('✅') ? '#F0FDF4' : '#FEF2F2', color: msg.startsWith('✅') ? '#065F46' : '#991B1B' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type='submit' disabled={saving} style={{ flex: 1, padding: '11px', background: '#10B981', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save Pricing'}</button>
              <button type='button' onClick={() => setEditing(false)} style={{ padding: '11px 20px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {pricing.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px', border: '2px dashed #E2E8F0' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🌏</div>
          <p style={{ fontSize: '16px', fontWeight: '600', color: '#0F172A', marginBottom: '8px' }}>No countries configured yet</p>
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Add a country to make VeraMed available in that region</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #F1F5F9', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Country','Currency','Patient Fee','Pharmacy %','Driver %','Doctor/Rx','Free KM','Per KM','Status','Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #F1F5F9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pricing.map((p: any) => (
                <tr key={p.country_code} style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <td style={{ padding: '12px 14px', fontWeight: '600', color: '#0F172A' }}>{p.country_name}</td>
                  <td style={{ padding: '12px 14px', color: '#64748B' }}>{p.currency_code} {p.currency_symbol}</td>
                  <td style={{ padding: '12px 14px' }}>{p.currency_symbol}{p.patient_fee}</td>
                  <td style={{ padding: '12px 14px' }}>{p.pharmacy_pct}%</td>
                  <td style={{ padding: '12px 14px' }}>{p.driver_pct}%</td>
                  <td style={{ padding: '12px 14px' }}>{p.currency_symbol}{p.doctor_fee}</td>
                  <td style={{ padding: '12px 14px' }}>{p.free_km}km</td>
                  <td style={{ padding: '12px 14px' }}>{p.currency_symbol}{p.per_km_fee}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '20px', background: p.is_active ? '#ECFDF5' : '#FEF2F2', color: p.is_active ? '#065F46' : '#991B1B' }}>{p.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => edit(p)} style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', background: 'white' }}>Edit</button>
                      <button onClick={() => toggle(p.country_code)} style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', background: 'white', color: p.is_active ? '#991B1B' : '#065F46' }}>{p.is_active ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => del(p.country_code)} style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #FECACA', borderRadius: '6px', cursor: 'pointer', background: '#FEF2F2', color: '#991B1B' }}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}