'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api-client';

export default function PrescriptionsPage() {
  const [ordering, setOrdering] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ['my-prescriptions'],
    queryFn: () => api.get('/patient/prescriptions').then(r => r.data).catch(() => []),
  });

  const handleOrder = async (prescriptionId: string, medications: any[]) => {
    setOrdering(prescriptionId);
    try {
      const items = medications.map((m: any) => ({ medicationId: m.id || m.name, quantity: 1, name: m.name }));
      await api.post('/orders/create', { prescriptionId, items });
      setOrderSuccess(prescriptionId);
    } catch (err: any) {
      alert('Order failed: ' + (err?.response?.data?.error || err.message));
    } finally { setOrdering(null); }
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    pending_review: { label: 'Awaiting Doctor', color: '#92400E', bg: '#FEF3C7', icon: '⏳' },
    approved: { label: 'Approved', color: '#15803D', bg: '#DCFCE7', icon: '✅' },
    rejected: { label: 'Rejected', color: '#991B1B', bg: '#FEE2E2', icon: '❌' },
    ordered: { label: 'Ordered', color: '#1D4ED8', bg: '#DBEAFE', icon: '📦' },
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '36px 40px 60px' }}>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 6px' }}>My Prescriptions</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: 0 }}>Doctor-approved prescriptions ready to order</p>
      </div>

      <div style={{ maxWidth: '800px', margin: '-30px auto 0', padding: '0 24px 48px' }}>
        {isLoading ? (
          <div style={{ background: 'white', borderRadius: '20px', padding: '60px', textAlign: 'center', color: '#6B7280', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>Loading prescriptions...</div>
        ) : !prescriptions || prescriptions.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '20px', padding: '60px 24px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💊</div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0B1F3A', marginBottom: '8px' }}>No prescriptions yet</h3>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>Upload a medical report to start the process. A doctor will review and issue a prescription.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {prescriptions.map((rx: any) => {
              const cfg = statusConfig[rx.status] || statusConfig.pending_review;
              const meds = rx.medications || [];
              const isApproved = rx.status === 'approved';
              const isOrdered = rx.status === 'ordered' || orderSuccess === rx.id;
              return (
                <div key={rx.id} style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: isApproved ? '1px solid #BBF7D0' : '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '0 0 4px' }}>
                        {new Date(rx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Dr. {rx.doctor?.user?.name || 'Assigned Doctor'}</p>
                    </div>
                    <span style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '20px', fontWeight: '600', background: cfg.bg, color: cfg.color }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  {rx.notes && (
                    <div style={{ padding: '12px 16px', background: '#F0F9FF', borderRadius: '10px', border: '1px solid #BAE6FD', marginBottom: '16px', fontSize: '13px', color: '#0369A1' }}>
                      <strong>Doctor's note:</strong> {rx.notes}
                    </div>
                  )}

                  {meds.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prescribed Medications</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {meds.map((med: any, i: number) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                            <div>
                              <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 2px' }}>💊 {med.name}</p>
                              <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>{med.dosageGuidance} • {med.frequency} • {med.duration}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isApproved && !isOrdered && (
                    <button onClick={() => handleOrder(rx.id, meds)} disabled={ordering === rx.id}
                      style={{ width: '100%', padding: '13px', background: ordering === rx.id ? '#9CA3AF' : '#3CBEA0', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: ordering === rx.id ? 'not-allowed' : 'pointer' }}>
                      {ordering === rx.id ? '⏳ Processing...' : '🛒 Order Medications'}
                    </button>
                  )}

                  {(isOrdered) && (
                    <div style={{ padding: '12px 16px', background: '#DBEAFE', borderRadius: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#1D4ED8' }}>
                      📦 Order placed — check My Orders for tracking
                    </div>
                  )}

                  {rx.status === 'rejected' && rx.rejectionReason && (
                    <div style={{ padding: '12px 16px', background: '#FEE2E2', borderRadius: '10px', fontSize: '13px', color: '#991B1B' }}>
                      <strong>Reason:</strong> {rx.rejectionReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
