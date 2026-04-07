'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api-client';
import { Upload, ClipboardCheck, Clock, Truck, ChevronRight, Package } from 'lucide-react';

export default function PatientDashboard() {
  const { user } = useAuthStore();

  const { data: prescriptions } = useQuery({
    queryKey: ['my-prescriptions'],
    queryFn: () => api.get('/patient/prescriptions').then((r) => r.data),
  });

  const { data: orders } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/patient/orders').then((r) => r.data),
  });

  const { data: reports } = useQuery({
    queryKey: ['my-reports'],
    queryFn: () => api.get('/patient/reports').then((r) => r.data),
  });

  const latestOrder = orders?.[0];
  const pendingCount = prescriptions?.filter((p: any) => p.status === 'pending_review').length || 0;
  const approvedCount = prescriptions?.filter((p: any) => p.status === 'approved').length || 0;

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#0B1F3A', borderRadius: '16px', padding: '28px', color: 'white', marginBottom: '24px' }}>
        <p style={{ color: '#3CBEA0', fontSize: '13px', marginBottom: '4px' }}>Good morning</p>
        <h2 style={{ fontSize: '22px', fontWeight: '600', marginBottom: '8px' }}>{user?.name || 'Patient'}</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '20px' }}>
          {pendingCount > 0 ? pendingCount + ' prescription(s) awaiting doctor review.' : 'Upload a report to get started.'}
        </p>
        <Link href="/patient/upload" style={{ background: '#3CBEA0', color: 'white', padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>
          Upload New Report
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Reports', value: reports?.length || 0 },
          { label: 'Pending Review', value: pendingCount },
          { label: 'Approved Rx', value: approvedCount },
          { label: 'Total Orders', value: orders?.length || 0 },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
            <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>{label}</p>
            <p style={{ fontSize: '24px', fontWeight: '600', color: '#0B1F3A' }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#0B1F3A' }}>Recent Reports</h3>
          <Link href="/patient/reports" style={{ fontSize: '12px', color: '#3CBEA0', textDecoration: 'none' }}>View all</Link>
        </div>
        {reports?.length > 0 ? reports.slice(0, 3).map((r: any) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f0fdf9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
              {r.processed ? '??' : '??'}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: '500', color: '#0B1F3A' }}>{r.fileName}</p>
              <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{new Date(r.createdAt).toLocaleDateString()}</p>
            </div>
            <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '20px', background: r.processed ? '#e6f8f2' : '#f3f4f6', color: r.processed ? '#0F7A5A' : '#6B7280' }}>
              {r.processed ? 'Analysed' : 'Processing'}
            </span>
          </div>
        )) : (
          <p style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No reports yet. Upload one to get started.</p>
        )}
      </div>
    </div>
  );
}
