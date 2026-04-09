'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export default function DoctorHistoryPage() {
  const { data: cases, isLoading } = useQuery({
    queryKey: ['all-cases'],
    queryFn: () => api.get('/doctor/pending-cases').then(r => r.data).catch(() => []),
  });

  const history = cases?.filter((c: any) => c.status === 'approved' || c.status === 'rejected') || [];

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '36px 40px 60px' }}>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 6px' }}>Case History</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: 0 }}>All previously reviewed prescriptions</p>
      </div>

      <div style={{ maxWidth: '800px', margin: '-30px auto 0', padding: '0 24px 48px' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '20px' }}>
            {isLoading ? 'Loading...' : `${history.length} Reviewed Case${history.length !== 1 ? 's' : ''}`}
          </h2>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>Loading history...</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0B1F3A', marginBottom: '8px' }}>No history yet</h3>
              <p style={{ color: '#6B7280', fontSize: '14px' }}>Cases you approve or reject will appear here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {history.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', border: '1px solid #F3F4F6', borderRadius: '14px', background: '#FAFAFA' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: c.status === 'approved' ? '#DCFCE7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                    {c.status === 'approved' ? '✅' : '❌'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 2px' }}>{c.patient?.user?.name || 'Patient'}</p>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 4px' }}>{c.patient?.user?.email}</p>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{new Date(c.updatedAt || c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '20px', fontWeight: '600', background: c.status === 'approved' ? '#DCFCE7' : '#FEE2E2', color: c.status === 'approved' ? '#15803D' : '#DC2626' }}>
                    {c.status === 'approved' ? 'Approved' : 'Rejected'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
