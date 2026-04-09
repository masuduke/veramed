'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';

export default function ReportsPage() {
  const { data: reports, isLoading } = useQuery({
    queryKey: ['my-reports'],
    queryFn: () => api.get('/patient/reports').then(r => r.data).catch(() => []),
  });

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '36px 40px 60px' }}>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 6px' }}>My Reports</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: 0 }}>All your uploaded medical reports and their AI analysis status</p>
      </div>

      <div style={{ maxWidth: '800px', margin: '-30px auto 0', padding: '0 24px 48px' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', margin: 0 }}>
              {isLoading ? 'Loading...' : `${reports?.length || 0} Report${reports?.length !== 1 ? 's' : ''}`}
            </h2>
            <Link href="/patient/upload" style={{ padding: '10px 20px', background: '#0B1F3A', color: 'white', borderRadius: '10px', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
              + Upload New
            </Link>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>Loading reports...</div>
          ) : !reports || reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0B1F3A', marginBottom: '8px' }}>No reports yet</h3>
              <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>Upload your first medical report to get AI-assisted analysis reviewed by a doctor.</p>
              <Link href="/patient/upload" style={{ padding: '12px 28px', background: '#3CBEA0', color: 'white', borderRadius: '12px', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>Upload First Report</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reports.map((r: any) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', border: '1px solid #F3F4F6', borderRadius: '14px', background: '#FAFAFA' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: r.processed ? '#DCFCE7' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                    {r.processed ? '🤖' : '📄'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.fileName || 'Medical Report'}
                    </p>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</p>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', fontWeight: '600', background: r.processed ? '#DCFCE7' : '#FEF3C7', color: r.processed ? '#15803D' : '#92400E' }}>
                      {r.processed ? '✓ AI Analysed' : '⏳ Processing'}
                    </span>
                    {r.symptoms?.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {r.symptoms.slice(0, 3).map((s: string) => (
                          <span key={s} style={{ fontSize: '10px', background: '#EEF2FF', color: '#4338CA', padding: '2px 8px', borderRadius: '10px' }}>{s}</span>
                        ))}
                        {r.symptoms.length > 3 && <span style={{ fontSize: '10px', color: '#9CA3AF' }}>+{r.symptoms.length - 3}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
