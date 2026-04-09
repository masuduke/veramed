'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api-client';

export default function DoctorDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [availability, setAvailability] = useState(true);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: cases, isLoading } = useQuery({
    queryKey: ['pending-cases'],
    queryFn: () => api.get('/doctor/pending-cases').then(r => r.data).catch(() => []),
    refetchInterval: 30000,
  });

  const pending = cases?.filter((c: any) => c.status === 'pending_review') || [];
  const approved = cases?.filter((c: any) => c.status === 'approved') || [];
  const rejected = cases?.filter((c: any) => c.status === 'rejected') || [];

  const handleApprove = async (caseId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/doctor/prescriptions/${caseId}/approve`, {
        medications: selectedCase?.aiAnalysis?.suggestedMedication || [],
        notes,
        validDays: 30,
      });
      queryClient.invalidateQueries({ queryKey: ['pending-cases'] });
      setSelectedCase(null);
      setNotes('');
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.error || err.message));
    } finally { setActionLoading(false); }
  };

  const handleReject = async (caseId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/doctor/prescriptions/${caseId}/reject`, { reason: rejectReason, notes });
      queryClient.invalidateQueries({ queryKey: ['pending-cases'] });
      setSelectedCase(null);
      setShowRejectModal(false);
      setRejectReason('');
      setNotes('');
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.error || err.message));
    } finally { setActionLoading(false); }
  };

  const firstName = user?.name?.split(' ').filter((w: string) => !w.startsWith('dr') && !w.startsWith('Dr')).join(' ') || user?.name || 'Doctor';

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); * { font-family: "DM Sans", sans-serif; box-sizing: border-box; } .case-row:hover { background: #F8FAFC !important; cursor: pointer; }`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '32px 40px 64px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(60,190,160,0.08)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ color: '#3CBEA0', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Doctor Portal</p>
            <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 6px' }}>Dr. {firstName}</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>Review AI-generated suggestions and issue prescriptions</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.08)', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: availability ? '#3CBEA0' : '#9CA3AF' }} />
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: '500' }}>{availability ? 'Accepting cases' : 'Unavailable'}</span>
            <button onClick={() => setAvailability(!availability)} style={{ width: '36px', height: '20px', borderRadius: '10px', border: 'none', background: availability ? '#3CBEA0' : '#374151', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', transition: 'left 0.2s', left: availability ? '19px' : '3px' }} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '-36px auto 0', padding: '0 24px 48px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Pending Review', value: pending.length, color: '#FEF3C7', accent: '#D97706', icon: '⏳' },
            { label: 'Approved Today', value: approved.length, color: '#DCFCE7', accent: '#16A34A', icon: '✅' },
            { label: 'Rejected', value: rejected.length, color: '#FEE2E2', accent: '#DC2626', icon: '❌' },
            { label: 'Total Cases', value: cases?.length || 0, color: '#EEF2FF', accent: '#4F46E5', icon: '📋' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '12px' }}>{s.icon}</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#0B1F3A', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px', fontWeight: '500' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>

          {/* Cases list */}
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', margin: 0 }}>
                {isLoading ? 'Loading cases...' : `Pending Cases (${pending.length})`}
              </h2>
              {pending.length > 0 && <span style={{ fontSize: '12px', background: '#FEF3C7', color: '#D97706', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' }}>Needs review</span>}
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>Loading...</div>
            ) : pending.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0B1F3A', marginBottom: '6px' }}>All caught up!</h3>
                <p style={{ color: '#6B7280', fontSize: '13px' }}>No pending cases right now.</p>
              </div>
            ) : (
              <div>
                {pending.map((c: any) => (
                  <div key={c.id} className="case-row" onClick={() => { setSelectedCase(c); setNotes(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', borderRadius: '12px', marginBottom: '8px', background: selectedCase?.id === c.id ? '#F0FDF4' : 'white', border: `1px solid ${selectedCase?.id === c.id ? '#BBF7D0' : '#F3F4F6'}`, transition: 'all 0.15s' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>👤</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 2px' }}>{c.patient?.user?.name || 'Patient'}</p>
                      <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.aiAnalysis?.report?.description?.slice(0, 60) || 'Medical report submitted'}...</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', background: '#FEF3C7', color: '#D97706', padding: '3px 8px', borderRadius: '20px', fontWeight: '600' }}>⏳ Pending</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Approved/rejected history */}
            {(approved.length > 0 || rejected.length > 0) && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #F3F4F6' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Recent History</p>
                {[...approved, ...rejected].slice(0, 5).map((c: any) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '10px', marginBottom: '6px', background: '#FAFAFA' }}>
                    <div style={{ fontSize: '16px' }}>{c.status === 'approved' ? '✅' : '❌'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: '#374151', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.patient?.user?.name || 'Patient'}</p>
                    </div>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', fontWeight: '600', background: c.status === 'approved' ? '#DCFCE7' : '#FEE2E2', color: c.status === 'approved' ? '#15803D' : '#DC2626' }}>
                      {c.status === 'approved' ? 'Approved' : 'Rejected'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Case detail / review panel */}
          <div>
            {!selectedCase ? (
              <div style={{ background: 'white', borderRadius: '20px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>👈</div>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#0B1F3A', marginBottom: '8px' }}>Select a case to review</h3>
                <p style={{ color: '#6B7280', fontSize: '13px', lineHeight: 1.6 }}>Click on any pending case from the list to view the AI analysis and issue your decision.</p>
                <div style={{ marginTop: '24px', padding: '14px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0', fontSize: '12px', color: '#15803D', lineHeight: 1.6 }}>
                  🛡️ All AI suggestions are <strong>advisory only</strong>. You retain full clinical authority to approve, modify, or reject.
                </div>
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                {/* Patient info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 4px' }}>{selectedCase.patient?.user?.name}</h3>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>{selectedCase.patient?.user?.email}</p>
                  </div>
                  <button onClick={() => setSelectedCase(null)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                </div>

                {/* Patient symptoms */}
                {selectedCase.aiAnalysis?.report?.description && (
                  <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '10px', marginBottom: '12px', fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>
                    <strong style={{ color: '#0B1F3A' }}>Patient reports:</strong> {selectedCase.aiAnalysis.report.description}
                  </div>
                )}

                {/* Symptoms tags */}
                {selectedCase.aiAnalysis?.report?.symptoms?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {selectedCase.aiAnalysis.report.symptoms.map((s: string) => (
                      <span key={s} style={{ fontSize: '11px', background: '#EEF2FF', color: '#4338CA', padding: '3px 8px', borderRadius: '10px', fontWeight: '500' }}>{s}</span>
                    ))}
                  </div>
                )}

                {/* AI Summary */}
                <div style={{ padding: '14px', background: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE', marginBottom: '12px' }}>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>🤖 AI Clinical Summary</p>
                  <p style={{ fontSize: '13px', color: '#1E3A5F', lineHeight: 1.6, margin: 0 }}>{selectedCase.aiAnalysis?.aiSummary || 'AI analysis in progress...'}</p>
                  {selectedCase.aiAnalysis?.confidenceScore && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '4px', background: '#DBEAFE', borderRadius: '2px' }}>
                        <div style={{ height: '100%', borderRadius: '2px', background: '#3B82F6', width: `${Math.round(selectedCase.aiAnalysis.confidenceScore * 100)}%` }} />
                      </div>
                      <span style={{ fontSize: '11px', color: '#1D4ED8', fontWeight: '600' }}>{Math.round(selectedCase.aiAnalysis.confidenceScore * 100)}% confidence</span>
                    </div>
                  )}
                </div>

                {/* Suggested medications */}
                {selectedCase.aiAnalysis?.suggestedMedication?.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Suggested Medications</p>
                    {selectedCase.aiAnalysis.suggestedMedication.map((m: any, i: number) => (
                      <div key={i} style={{ padding: '10px 12px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB', marginBottom: '6px' }}>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#0B1F3A', margin: '0 0 2px' }}>💊 {m.name}</p>
                        <p style={{ fontSize: '11px', color: '#6B7280', margin: 0 }}>{m.dosageGuidance} • {m.frequency} • {m.duration}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {selectedCase.aiAnalysis?.warnings?.length > 0 && (
                  <div style={{ padding: '10px 12px', background: '#FFFBEB', borderRadius: '10px', border: '1px solid #FCD34D', marginBottom: '12px' }}>
                    <p style={{ fontSize: '11px', fontWeight: '700', color: '#D97706', marginBottom: '4px' }}>⚠️ Flags</p>
                    {selectedCase.aiAnalysis.warnings.map((w: string, i: number) => (
                      <p key={i} style={{ fontSize: '12px', color: '#92400E', margin: '2px 0' }}>• {w}</p>
                    ))}
                  </div>
                )}

                {/* Doctor notes */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Your Clinical Notes (optional)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px', fontSize: '13px', resize: 'none', outline: 'none', lineHeight: 1.5 }}
                    placeholder="Add notes for the patient or pharmacy..." />
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowRejectModal(true)}
                    style={{ flex: 1, padding: '12px', border: '1px solid #FECACA', borderRadius: '10px', background: 'white', color: '#DC2626', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    ❌ Reject
                  </button>
                  <button onClick={() => handleApprove(selectedCase.id)} disabled={actionLoading}
                    style={{ flex: 2, padding: '12px', border: 'none', borderRadius: '10px', background: actionLoading ? '#9CA3AF' : '#3CBEA0', color: 'white', fontSize: '13px', fontWeight: '700', cursor: actionLoading ? 'not-allowed' : 'pointer' }}>
                    {actionLoading ? '⏳ Processing...' : '✅ Approve Prescription'}
                  </button>
                </div>

                <p style={{ fontSize: '11px', color: '#9CA3AF', textAlign: 'center', marginTop: '10px', lineHeight: 1.5 }}>
                  Approving will notify the patient and make the prescription available for ordering.
                </p>
              </div>
            )}

            {/* Impact box */}
            <div style={{ background: 'linear-gradient(135deg, #0B1F3A, #1a3a5c)', borderRadius: '20px', padding: '20px', marginTop: '16px', color: 'white' }}>
              <p style={{ fontSize: '12px', color: '#3CBEA0', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📊 Your Impact</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.6 }}>
                You&apos;ve approved <strong style={{ color: 'white' }}>{approved.length}</strong> prescription{approved.length !== 1 ? 's' : ''}, helping patients access medication faster through doctor-verified AI assistance.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0B1F3A', marginBottom: '8px' }}>Reject Prescription</h3>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px', lineHeight: 1.6 }}>Please provide a clear reason. The patient will be notified so they understand next steps.</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={4}
              style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '12px', fontSize: '13px', resize: 'none', marginBottom: '16px', outline: 'none' }}
              placeholder="e.g. Insufficient medical history provided. Please upload blood test results before resubmitting." />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                style={{ flex: 1, padding: '12px', border: '1px solid #E5E7EB', borderRadius: '10px', background: 'white', color: '#374151', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={() => handleReject(selectedCase.id)} disabled={rejectReason.length < 10 || actionLoading}
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
