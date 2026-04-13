'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api-client';

const SPECIALTY_LABELS: Record<string, string> = {
  general_medicine: 'General Medicine / GP', cardiology: 'Cardiology',
  gynaecology: 'Gynaecology', dermatology: 'Dermatology', neurology: 'Neurology',
  paediatrics: 'Paediatrics', orthopaedics: 'Orthopaedics', psychiatry: 'Psychiatry',
  oncology: 'Oncology', emergency_medicine: 'Emergency Medicine',
  endocrinology: 'Endocrinology', gastroenterology: 'Gastroenterology',
  pulmonology: 'Pulmonology', nephrology: 'Nephrology', rheumatology: 'Rheumatology',
};

const SPECIALTY_ICONS: Record<string, string> = {
  general_medicine: '🩺', cardiology: '❤️', gynaecology: '🌸', dermatology: '🔬',
  neurology: '🧠', paediatrics: '👶', orthopaedics: '🦴', psychiatry: '💆',
  oncology: '🎗️', emergency_medicine: '🚨', endocrinology: '⚗️',
  gastroenterology: '🫁', pulmonology: '💨', nephrology: '💧', rheumatology: '🦾',
};

const SPECIALTIES = Object.entries(SPECIALTY_LABELS).map(([value, label]) => ({ value, label }));

export default function DoctorDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(true);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [safeToDispensePartial, setSafeToDispensePartial] = useState(false);
  const [partialNote, setPartialNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [mySpecialty, setMySpecialty] = useState('');
  const [savingSpecialty, setSavingSpecialty] = useState(false);
  const [specialtySaved, setSpecialtySaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending'|'history'|'profile'>('pending');

  const { data: cases, isLoading } = useQuery({
    queryKey: ['pending-cases'],
    queryFn: () => api.get('/doctor/pending-cases').then(r => r.data).catch(() => []),
    refetchInterval: 30000,
  });

  const { data: escalations } = useQuery({
    queryKey: ['escalations'],
    queryFn: () => api.get('/doctor/escalations').then(r => r.data).catch(() => []),
  });

  const pending = (cases || []).filter((c: any) => ['pending', 'escalated'].includes(c.status));
  const history = (cases || []).filter((c: any) => ['approved', 'rejected'].includes(c.status));

  // Load doctor's specialty from their profile
  useEffect(() => {
    api.get('/doctor/profile').then(r => {
      if (r.data?.specialization) setMySpecialty(r.data.specialization);
    }).catch(() => {});
  }, []);

  const handleSaveSpecialty = async () => {
    if (!mySpecialty) return;
    setSavingSpecialty(true);
    try {
      await api.put('/doctor/profile/specialty', { specialization: mySpecialty });
      setSpecialtySaved(true);
      setTimeout(() => setSpecialtySaved(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['pending-cases'] });
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.error || err.message));
    } finally { setSavingSpecialty(false); }
  };

  const handleApprove = async () => {
    if (!selectedCase) return;
    setActionLoading(true);
    try {
      await api.post(`/doctor/prescriptions/${selectedCase.id}/approve`, {
        medications: selectedCase.aiAnalysis?.suggestedMedication || selectedCase.myMedications || [],
        notes: doctorNotes,
        validDays: 30,
        safeToDispensePartial,
        partialDispenseNote: partialNote,
      });
      queryClient.invalidateQueries({ queryKey: ['pending-cases'] });
      setSelectedCase(null);
      setDoctorNotes('');
      setSafeToDispensePartial(false);
      setPartialNote('');
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.error || err.message));
    } finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!selectedCase || rejectReason.length < 10) return;
    setActionLoading(true);
    try {
      await api.post(`/doctor/prescriptions/${selectedCase.id}/reject`, {
        reason: rejectReason, notes: doctorNotes,
      });
      queryClient.invalidateQueries({ queryKey: ['pending-cases'] });
      setSelectedCase(null);
      setShowRejectModal(false);
      setRejectReason('');
      setDoctorNotes('');
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.error || err.message));
    } finally { setActionLoading(false); }
  };

  const firstName = user?.name?.split(' ').filter((w: string) => !['dr', 'dr.'].includes(w.toLowerCase())).join(' ') || 'Doctor';
  const specialtyLabel = SPECIALTY_LABELS[mySpecialty] || 'Set your specialty';
  const specialtyIcon = SPECIALTY_ICONS[mySpecialty] || '🏥';

  const tabStyle = (t: string) => ({
    padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: '600', transition: 'all 0.15s',
    background: activeTab === t ? '#0B1F3A' : 'white',
    color: activeTab === t ? 'white' : '#6B7280',
  } as React.CSSProperties);

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); *{font-family:"DM Sans",sans-serif;box-sizing:border-box;} .case-row:hover{background:#F8FAFC !important;cursor:pointer;} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '32px 40px 64px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(60,190,160,0.08)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '24px' }}>{specialtyIcon}</span>
              <span style={{ color: '#3CBEA0', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{specialtyLabel}</span>
            </div>
            <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 4px' }}>Dr. {firstName}</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
              You only see cases requiring <strong style={{ color: '#3CBEA0' }}>{specialtyLabel}</strong> review
            </p>
          </div>
          {/* Online toggle */}
          <div onClick={() => setIsOnline(!isOnline)} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: isOnline ? 'rgba(60,190,160,0.15)' : 'rgba(255,255,255,0.08)', padding: '10px 16px', borderRadius: '12px', border: `1px solid ${isOnline ? 'rgba(60,190,160,0.4)' : 'rgba(255,255,255,0.12)'}`, cursor: 'pointer' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? '#3CBEA0' : '#6B7280', animation: isOnline ? 'pulse 2s infinite' : 'none' }} />
            <span style={{ color: isOnline ? '#3CBEA0' : 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>{isOnline ? 'Accepting Cases' : 'Unavailable'}</span>
            <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: isOnline ? '#3CBEA0' : '#374151', position: 'relative' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: isOnline ? '19px' : '3px', transition: 'left 0.2s' }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '-36px auto 0', padding: '0 24px 48px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'My Pending Cases', value: pending.length, icon: '⏳', bg: '#FEF3C7', accent: '#D97706' },
            { label: 'Approved Today', value: history.filter((c: any) => c.status === 'approved').length, icon: '✅', bg: '#DCFCE7', accent: '#16A34A' },
            { label: 'Rejected', value: history.filter((c: any) => c.status === 'rejected').length, icon: '❌', bg: '#FEE2E2', accent: '#DC2626' },
            { label: 'Escalations', value: escalations?.length || 0, icon: '🚨', bg: '#F5F3FF', accent: '#7C3AED' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '12px' }}>{s.icon}</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#0B1F3A', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#E5E7EB', padding: '4px', borderRadius: '14px', width: 'fit-content' }}>
          {[
            { k: 'pending', l: `⏳ My Cases${pending.length > 0 ? ` (${pending.length})` : ''}` },
            { k: 'history', l: '📋 History' },
            { k: 'profile', l: '⚙️ My Specialty' },
          ].map(t => <button key={t.k} style={tabStyle(t.k)} onClick={() => setActiveTab(t.k as any)}>{t.l}</button>)}
        </div>

        {/* PENDING CASES */}
        {activeTab === 'pending' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedCase ? '1fr 420px' : '1fr', gap: '24px' }}>

            {/* Case list */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', margin: 0 }}>
                  {isLoading ? 'Loading...' : `Cases for ${specialtyLabel} (${pending.length})`}
                </h2>
                {pending.length > 0 && <span style={{ fontSize: '11px', background: '#FEF3C7', color: '#D97706', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' }}>Needs review</span>}
              </div>

              {!mySpecialty && (
                <div style={{ padding: '16px', background: '#FEF3C7', borderRadius: '12px', border: '1px solid #FCD34D', marginBottom: '16px', fontSize: '13px', color: '#92400E' }}>
                  ⚠️ Please set your specialty in the <strong>My Specialty</strong> tab to receive matching cases.
                </div>
              )}

              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>Loading your cases...</div>
              ) : pending.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0B1F3A', marginBottom: '6px' }}>All caught up!</h3>
                  <p style={{ color: '#6B7280', fontSize: '13px' }}>No pending {specialtyLabel} cases right now.</p>
                </div>
              ) : (
                pending.map((c: any) => (
                  <div key={c.id} className="case-row" onClick={() => { setSelectedCase(c); setDoctorNotes(''); setSafeToDispensePartial(false); setPartialNote(''); }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '14px', borderRadius: '12px', marginBottom: '8px', background: selectedCase?.id === c.id ? '#F0FDF4' : 'white', border: `1px solid ${selectedCase?.id === c.id ? '#BBF7D0' : '#F3F4F6'}`, transition: 'all 0.15s' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: c.status === 'escalated' ? '#FEE2E2' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                      {c.status === 'escalated' ? '🚨' : '👤'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 2px' }}>{c.patient?.user?.name || 'Patient'}</p>
                          <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>
                            {c.aiAnalysis?.report?.description?.slice(0, 60) || 'Medical report submitted'}...
                          </p>
                        </div>
                        <span style={{ fontSize: '11px', background: c.status === 'escalated' ? '#FEE2E2' : '#FEF3C7', color: c.status === 'escalated' ? '#DC2626' : '#D97706', padding: '3px 8px', borderRadius: '20px', fontWeight: '600', flexShrink: 0, marginLeft: '8px' }}>
                          {c.status === 'escalated' ? '🚨 Escalated' : '⏳ Pending'}
                        </span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>

                      {/* Other specialties status (read-only context) */}
                      {c.otherApprovals?.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {c.otherApprovals.map((oa: any) => (
                            <span key={oa.specialty} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', fontWeight: '500',
                              background: oa.status === 'approved' ? '#DCFCE7' : oa.status === 'rejected' ? '#FEE2E2' : '#F3F4F6',
                              color: oa.status === 'approved' ? '#15803D' : oa.status === 'rejected' ? '#DC2626' : '#6B7280' }}>
                              {SPECIALTY_ICONS[oa.specialty] || '🏥'} {SPECIALTY_LABELS[oa.specialty]}: {oa.status}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Case review panel */}
            {selectedCase && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>

                  {/* Case header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 2px' }}>{selectedCase.patient?.user?.name}</h3>
                      <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>{selectedCase.patient?.user?.email}</p>
                    </div>
                    <button onClick={() => setSelectedCase(null)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                  </div>

                  {/* My specialty banner */}
                  <div style={{ padding: '10px 14px', background: '#EEF2FF', borderRadius: '10px', border: '1px solid #C7D2FE', marginBottom: '14px', fontSize: '12px', color: '#4338CA', fontWeight: '600' }}>
                    {specialtyIcon} You are reviewing this case as <strong>{specialtyLabel}</strong>
                  </div>

                  {/* Patient description */}
                  {selectedCase.aiAnalysis?.report?.description && (
                    <div style={{ padding: '10px 12px', background: '#F9FAFB', borderRadius: '10px', marginBottom: '12px', fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>
                      <strong style={{ color: '#0B1F3A' }}>Patient reports:</strong> {selectedCase.aiAnalysis.report.description}
                    </div>
                  )}

                  {/* Symptoms */}
                  {selectedCase.aiAnalysis?.report?.symptoms?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
                      {selectedCase.aiAnalysis.report.symptoms.map((s: string) => (
                        <span key={s} style={{ fontSize: '11px', background: '#EEF2FF', color: '#4338CA', padding: '3px 8px', borderRadius: '10px' }}>{s}</span>
                      ))}
                    </div>
                  )}

                  {/* AI Summary */}
                  {selectedCase.aiAnalysis?.aiSummary && (
                    <div style={{ padding: '12px 14px', background: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE', marginBottom: '12px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>🤖 AI Summary</p>
                      <p style={{ fontSize: '13px', color: '#1E3A5F', lineHeight: 1.6, margin: 0 }}>{selectedCase.aiAnalysis.aiSummary}</p>
                      {selectedCase.aiAnalysis.confidenceScore && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '4px', background: '#DBEAFE', borderRadius: '2px' }}>
                            <div style={{ height: '100%', borderRadius: '2px', background: '#3B82F6', width: `${Math.round(selectedCase.aiAnalysis.confidenceScore * 100)}%` }} />
                          </div>
                          <span style={{ fontSize: '11px', color: '#1D4ED8', fontWeight: '600' }}>{Math.round(selectedCase.aiAnalysis.confidenceScore * 100)}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* MY medications to review */}
                  {(selectedCase.myMedications?.length > 0 || selectedCase.aiAnalysis?.suggestedMedication?.length > 0) && (
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        My Medications to Review ({specialtyLabel})
                      </p>
                      {(selectedCase.myMedications || selectedCase.aiAnalysis?.suggestedMedication || []).map((m: any, i: number) => (
                        <div key={i} style={{ padding: '10px 12px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB', marginBottom: '6px' }}>
                          <p style={{ fontSize: '13px', fontWeight: '600', color: '#0B1F3A', margin: '0 0 2px' }}>💊 {m.name}</p>
                          <p style={{ fontSize: '11px', color: '#6B7280', margin: 0 }}>{m.dosageGuidance} • {m.frequency} • {m.duration}</p>
                          {m.reasoning && <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '4px 0 0', fontStyle: 'italic' }}>{m.reasoning}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Other specialists status (read-only) */}
                  {selectedCase.otherApprovals?.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Other Specialists (read-only)</p>
                      {selectedCase.otherApprovals.map((oa: any) => (
                        <div key={oa.specialty} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', marginBottom: '4px', background: oa.status === 'approved' ? '#F0FDF4' : oa.status === 'rejected' ? '#FEF2F2' : '#F9FAFB', border: '1px solid #F3F4F6' }}>
                          <span style={{ fontSize: '12px', color: '#374151' }}>{SPECIALTY_ICONS[oa.specialty] || '🏥'} {SPECIALTY_LABELS[oa.specialty] || oa.specialty}</span>
                          <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px',
                            background: oa.status === 'approved' ? '#DCFCE7' : oa.status === 'rejected' ? '#FEE2E2' : '#FEF3C7',
                            color: oa.status === 'approved' ? '#15803D' : oa.status === 'rejected' ? '#DC2626' : '#D97706' }}>
                            {oa.status === 'approved' ? '✅ Approved' : oa.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {selectedCase.aiAnalysis?.warnings?.length > 0 && (
                    <div style={{ padding: '10px 12px', background: '#FFFBEB', borderRadius: '10px', border: '1px solid #FCD34D', marginBottom: '12px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#D97706', marginBottom: '4px' }}>⚠️ AI Flags</p>
                      {selectedCase.aiAnalysis.warnings.map((w: string, i: number) => (
                        <p key={i} style={{ fontSize: '12px', color: '#92400E', margin: '2px 0' }}>• {w}</p>
                      ))}
                    </div>
                  )}

                  {/* Safe to dispense partial option */}
                  {selectedCase.otherApprovals?.some((oa: any) => oa.status === 'pending') && (
                    <div style={{ padding: '14px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <input type="checkbox" checked={safeToDispensePartial} onChange={e => setSafeToDispensePartial(e.target.checked)}
                          style={{ width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer', accentColor: '#3CBEA0' }} />
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: '700', color: '#15803D', margin: '0 0 2px' }}>⚡ Safe to dispense my medications now</p>
                          <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 6px', lineHeight: 1.5 }}>
                            Flag this if your medications are safe for the patient to start before other specialists complete their review.
                          </p>
                          {safeToDispensePartial && (
                            <input value={partialNote} onChange={e => setPartialNote(e.target.value)} placeholder="Add note explaining why safe to dispense early (optional)"
                              style={{ width: '100%', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '7px 10px', fontSize: '12px', outline: 'none' }} />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Doctor notes */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>My Clinical Notes</label>
                    <textarea value={doctorNotes} onChange={e => setDoctorNotes(e.target.value)} rows={3}
                      style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px', fontSize: '13px', resize: 'none', outline: 'none', lineHeight: 1.5 }}
                      placeholder="Add notes for patient, pharmacy or other specialists..." />
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setShowRejectModal(true)}
                      style={{ flex: 1, padding: '12px', border: '1px solid #FECACA', borderRadius: '10px', background: 'white', color: '#DC2626', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                      ❌ Reject
                    </button>
                    <button onClick={handleApprove} disabled={actionLoading}
                      style={{ flex: 2, padding: '12px', border: 'none', borderRadius: '10px', background: actionLoading ? '#9CA3AF' : '#3CBEA0', color: 'white', fontSize: '13px', fontWeight: '700', cursor: actionLoading ? 'not-allowed' : 'pointer' }}>
                      {actionLoading ? '⏳ Processing...' : safeToDispensePartial ? '✅ Approve + Allow Early Dispense' : '✅ Approve My Section'}
                    </button>
                  </div>

                  <p style={{ fontSize: '11px', color: '#9CA3AF', textAlign: 'center', marginTop: '10px', lineHeight: 1.5 }}>
                    You are approving only the <strong>{specialtyLabel}</strong> section.
                    {selectedCase.otherApprovals?.some((oa: any) => oa.status === 'pending') && ' Other specialists must also approve their sections.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '20px' }}>Case History ({history.length})</h2>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📋</div>
                <p>No reviewed cases yet.</p>
              </div>
            ) : history.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', border: '1px solid #F3F4F6', borderRadius: '12px', marginBottom: '8px', background: '#FAFAFA' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: c.status === 'approved' ? '#DCFCE7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                  {c.status === 'approved' ? '✅' : '❌'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 2px' }}>{c.patient?.user?.name || 'Patient'}</p>
                  <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '20px', fontWeight: '600', background: c.status === 'approved' ? '#DCFCE7' : '#FEE2E2', color: c.status === 'approved' ? '#15803D' : '#DC2626' }}>
                  {c.status === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* SPECIALTY PROFILE TAB */}
        {activeTab === 'profile' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>My Specialty Settings</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>Set your specialization so the system routes only matching cases to your queue.</p>

            {specialtySaved && <div style={{ padding: '12px', background: '#DCFCE7', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', color: '#15803D' }}>✅ Specialty saved — your case queue will now filter accordingly.</div>}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Your Specialization</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                {SPECIALTIES.map(s => (
                  <button key={s.value} onClick={() => setMySpecialty(s.value)}
                    style={{ padding: '12px 14px', border: `2px solid ${mySpecialty === s.value ? '#3CBEA0' : '#E5E7EB'}`, borderRadius: '12px', background: mySpecialty === s.value ? '#F0FDF4' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>{SPECIALTY_ICONS[s.value] || '🏥'}</div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: mySpecialty === s.value ? '#15803D' : '#0B1F3A' }}>{s.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '14px 16px', background: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE', marginBottom: '20px', fontSize: '13px', color: '#1D4ED8', lineHeight: 1.6 }}>
              💡 Once set, you will <strong>only see cases that require {mySpecialty ? SPECIALTY_LABELS[mySpecialty] : 'your specialty'} review</strong>.
              Cases requiring multiple specialists show you only your section — you can see other specialists&apos; decisions as read-only context.
            </div>

            <button onClick={handleSaveSpecialty} disabled={savingSpecialty || !mySpecialty}
              style={{ padding: '12px 28px', background: !mySpecialty ? '#9CA3AF' : '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: !mySpecialty ? 'not-allowed' : 'pointer' }}>
              {savingSpecialty ? 'Saving...' : `💾 Save — ${mySpecialty ? SPECIALTY_LABELS[mySpecialty] : 'Select specialty first'}`}
            </button>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0B1F3A', marginBottom: '8px' }}>Reject — {SPECIALTY_LABELS[mySpecialty]} Section</h3>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px', lineHeight: 1.6 }}>Please provide a clear reason. The patient will be notified.</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={4}
              style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '12px', fontSize: '13px', resize: 'none', marginBottom: '16px', outline: 'none' }}
              placeholder="e.g. Insufficient cardiac history. Please provide recent ECG and echocardiogram before resubmitting." />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                style={{ flex: 1, padding: '12px', border: '1px solid #E5E7EB', borderRadius: '10px', background: 'white', color: '#374151', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={handleReject} disabled={rejectReason.length < 10 || actionLoading}
                style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '10px', background: rejectReason.length < 10 ? '#9CA3AF' : '#DC2626', color: 'white', cursor: rejectReason.length < 10 ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600' }}>
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
