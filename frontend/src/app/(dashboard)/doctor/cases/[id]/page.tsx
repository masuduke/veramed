'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
interface Medication { name: string; dosageGuidance: string; frequency: string; duration: string; reasoning: string; }
interface CaseDetail { id: string; patient: { user: { name: string; email: string; }; }; aiAnalysis: { aiSummary: string; suggestedMedication: Medication[]; confidenceScore: number; report: { description: string; }; }; }
export default function CaseReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [doctorNotes, setDoctorNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [showReject, setShowReject] = useState(false);
  const { data: caseData, isLoading } = useQuery<CaseDetail>({
    queryKey: ['case', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get('/doctor/pending-cases');
      return res.data.find((c: CaseDetail) => c.id === id);
    },
  });
  useEffect(() => {
    if (caseData?.aiAnalysis?.suggestedMedication) {
      setMedications(caseData.aiAnalysis.suggestedMedication);
    }
  }, [caseData]);
  const approveMutation = useMutation({
    mutationFn: () => api.post('/doctor/prescriptions/' + id + '/approve', { medications, notes: doctorNotes, validDays: 30 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pending-cases'] }); router.push('/doctor'); },
  });
  const rejectMutation = useMutation({
    mutationFn: () => api.post('/doctor/prescriptions/' + id + '/reject', { reason: rejectReason, notes: doctorNotes }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pending-cases'] }); router.push('/doctor'); },
  });
  if (isLoading) return <div style={{ padding: '32px', textAlign: 'center', color: '#6B7280' }}>Loading...</div>;
  if (!caseData) return <div style={{ padding: '32px', textAlign: 'center', color: '#dc2626' }}>Case not found</div>;
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#0B1F3A' }}>Case Review: {caseData.patient.user.name}</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setShowReject(true)} style={{ padding: '10px 20px', border: '1px solid #fca5a5', borderRadius: '10px', color: '#dc2626', cursor: 'pointer', background: 'white' }}>Reject</button>
          <button onClick={() => approveMutation.mutate()} disabled={medications.length === 0} style={{ padding: '10px 20px', background: '#3CBEA0', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>{approveMutation.isPending ? 'Approving...' : 'Approve'}</button>
        </div>
      </div>
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
        <p style={{ fontSize: '13px', color: '#374151' }}><strong>AI Summary:</strong> {caseData.aiAnalysis.aiSummary}</p>
        <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '8px' }}>Confidence: {Math.round((caseData.aiAnalysis.confidenceScore || 0) * 100)}%</p>
      </div>
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Medications</h3>
        {medications.map((med, i) => (
          <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
            <input value={med.name} onChange={e => { const m = [...medications]; m[i] = {...m[i], name: e.target.value}; setMedications(m); }} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', marginBottom: '8px', boxSizing: 'border-box' as const }} />
            <p style={{ fontSize: '12px', color: '#6B7280' }}>{med.reasoning}</p>
          </div>
        ))}
      </div>
      <textarea value={doctorNotes} onChange={e => setDoctorNotes(e.target.value)} rows={3} placeholder='Doctor notes...' style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', fontSize: '13px', boxSizing: 'border-box' as const, marginBottom: '20px' }} />
      {showReject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '400px' }}>
            <h3 style={{ marginBottom: '12px' }}>Reject Prescription</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={4} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', marginBottom: '16px', boxSizing: 'border-box' as const }} />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReject(false)} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => rejectMutation.mutate()} style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}