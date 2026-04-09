'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api-client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  ai_generated:   { bg: '#EEF2FF', text: '#4338CA', dot: '#818CF8' },
  pending_review: { bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B' },
  approved:       { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  rejected:       { bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
  modified:       { bg: '#EFF6FF', text: '#1E40AF', dot: '#3B82F6' },
};

const STATUS_LABELS: Record<string, string> = {
  ai_generated:   'AI Processing',
  pending_review: 'Doctor Review',
  approved:       'Approved',
  rejected:       'Rejected',
  modified:       'Modified',
};

const ORDER_LABELS: Record<string, string> = {
  pending:          'Payment Pending',
  confirmed:        'Confirmed',
  preparing:        'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  in_transit:       'On the Way',
  delivered:        'Delivered',
  cancelled:        'Cancelled',
};

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{
      background: 'white', borderRadius: '16px', padding: '20px 24px',
      border: '1px solid #F1F5F9', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '4px', height: '100%',
        background: accent, borderRadius: '16px 0 0 16px',
      }} />
      <p style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</p>
      <p style={{ fontSize: '32px', fontWeight: '700', color: '#0F172A', lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function PrescriptionCard({ rx }: { rx: any }) {
  const s = STATUS_COLORS[rx.status] || STATUS_COLORS.pending_review;
  const label = STATUS_LABELS[rx.status] || rx.status;
  const meds = rx.medications as any[];

  return (
    <div style={{
      background: 'white', borderRadius: '16px', padding: '20px',
      border: '1px solid #F1F5F9', transition: 'box-shadow 0.2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 30px rgba(15,23,42,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.dot }} />
          <span style={{ fontSize: '12px', fontWeight: '600', color: s.text, background: s.bg, padding: '4px 10px', borderRadius: '20px' }}>{label}</span>
        </div>
        <span style={{ fontSize: '11px', color: '#94A3B8' }}>{new Date(rx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>

      {rx.status === 'approved' && meds?.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {meds.slice(0, 2).map((m: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#F8FAFC', borderRadius: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>💊</div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', margin: 0 }}>{m.name}</p>
                <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>{m.dosageGuidance} · {m.frequency}</p>
              </div>
            </div>
          ))}
          {rx.status === 'approved' && (
            <Link href={`/patient/prescriptions/${rx.id}/order`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              marginTop: '6px', padding: '10px', background: '#0F172A', color: 'white',
              borderRadius: '10px', fontSize: '13px', fontWeight: '600', textDecoration: 'none',
            }}>
              Order Medication →
            </Link>
          )}
        </div>
      ) : rx.status === 'pending_review' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#FFFBEB', borderRadius: '10px' }}>
          <div style={{ fontSize: '20px' }}>⏳</div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#92400E', margin: 0 }}>Awaiting doctor review</p>
            <p style={{ fontSize: '11px', color: '#B45309', margin: 0 }}>Average response time: 24 minutes</p>
          </div>
        </div>
      ) : rx.status === 'rejected' ? (
        <div style={{ padding: '12px', background: '#FEF2F2', borderRadius: '10px' }}>
          <p style={{ fontSize: '12px', color: '#991B1B', margin: 0 }}>{rx.rejectionReason || 'Please consult your doctor for more information.'}</p>
        </div>
      ) : (
        <div style={{ padding: '12px', background: '#EEF2FF', borderRadius: '10px' }}>
          <p style={{ fontSize: '12px', color: '#4338CA', margin: 0 }}>AI analysis complete. Queued for doctor review.</p>
        </div>
      )}
    </div>
  );
}

function OrderTracker({ order }: { order: any }) {
  const steps = ['confirmed', 'preparing', 'in_transit', 'delivered'];
  const currentIdx = steps.indexOf(order.status === 'ready_for_pickup' ? 'in_transit' : order.status);

  return (
    <div style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', margin: 0 }}>{ORDER_LABELS[order.status] || order.status}</p>
          <p style={{ fontSize: '11px', color: '#94A3B8', margin: '2px 0 0' }}>{order.pharmacy?.storeName || 'Pharmacy'}</p>
        </div>
        <p style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', margin: 0 }}>£{Number(order.totalPrice).toFixed(2)}</p>
      </div>

      <div style={{ position: 'relative', marginBottom: '8px' }}>
        <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', height: '2px', background: '#F1F5F9' }} />
        <div style={{
          position: 'absolute', top: '10px', left: '10px',
          width: currentIdx < 0 ? '0%' : `${(currentIdx / (steps.length - 1)) * 100}%`,
          height: '2px', background: 'linear-gradient(90deg, #10B981, #3B82F6)',
          transition: 'width 0.5s ease',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
          {steps.map((s, i) => {
            const done = currentIdx >= i;
            const labels: Record<string, string> = { confirmed: 'Confirmed', preparing: 'Preparing', in_transit: 'In Transit', delivered: 'Delivered' };
            return (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', zIndex: 1,
                  background: done ? '#10B981' : 'white',
                  border: done ? '2px solid #10B981' : '2px solid #E2E8F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done && <span style={{ color: 'white', fontSize: '10px', fontWeight: '700' }}>✓</span>}
                </div>
                <span style={{ fontSize: '10px', color: done ? '#059669' : '#94A3B8', fontWeight: done ? '600' : '400' }}>{labels[s]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PatientDashboard() {
  const { user } = useAuthStore();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/api/patient/prescriptions`, { headers }).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/patient/orders`, { headers }).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/patient/reports`, { headers }).then(r => r.json()).catch(() => []),
    ]).then(([rx, ord, rep]) => {
      setPrescriptions(Array.isArray(rx) ? rx : []);
      setOrders(Array.isArray(ord) ? ord : []);
      setReports(Array.isArray(rep) ? rep : []);
      setLoading(false);
    });
  }, []);

  const pending = prescriptions.filter(p => p.status === 'pending_review').length;
  const approved = prescriptions.filter(p => p.status === 'approved').length;
  const activeOrder = orders.find(o => !['delivered', 'cancelled'].includes(o.status));

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@600&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Hero Welcome */}
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0F172A 100%)',
          borderRadius: '24px', padding: '36px 40px', marginBottom: '28px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(16,185,129,0.08)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-60px', right: '100px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(59,130,246,0.08)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '20px', right: '200px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16,185,129,0.05)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: '13px', fontWeight: '500', color: '#34D399', letterSpacing: '0.04em', marginBottom: '6px' }}>{greeting}</p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', fontWeight: '600', color: 'white', marginBottom: '10px', lineHeight: 1.2 }}>
              {user?.name || 'Patient'} 👋
            </h1>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', marginBottom: '28px', maxWidth: '480px', lineHeight: 1.6 }}>
              {pending > 0
                ? `You have ${pending} prescription${pending > 1 ? 's' : ''} awaiting doctor review. We'll notify you when ready.`
                : activeOrder
                ? `Your order is ${ORDER_LABELS[activeOrder.status]?.toLowerCase()}. Track it below.`
                : 'Your health dashboard is up to date. Upload a report to get started.'}
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/patient/upload" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 24px', background: '#10B981', color: 'white',
                borderRadius: '12px', fontSize: '14px', fontWeight: '600', textDecoration: 'none',
                transition: 'all 0.2s',
              }}>
                <span style={{ fontSize: '16px' }}>📋</span> Upload New Report
              </Link>
              <Link href="/patient/prescriptions" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 24px', background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white', borderRadius: '12px', fontSize: '14px', fontWeight: '500', textDecoration: 'none',
              }}>
                View Prescriptions
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
          <StatCard label="Total Reports" value={reports.length} accent="#6366F1" />
          <StatCard label="Pending Review" value={pending} accent="#F59E0B" />
          <StatCard label="Approved Rx" value={approved} accent="#10B981" />
          <StatCard label="Total Orders" value={orders.length} accent="#3B82F6" />
        </div>

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

          {/* Prescriptions */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Prescriptions</h2>
              <Link href="/patient/prescriptions" style={{ fontSize: '12px', color: '#10B981', fontWeight: '600', textDecoration: 'none' }}>View all →</Link>
            </div>
            {loading ? (
              <div style={{ background: 'white', borderRadius: '16px', padding: '40px', textAlign: 'center', border: '1px solid #F1F5F9' }}>
                <p style={{ color: '#94A3B8', fontSize: '14px' }}>Loading...</p>
              </div>
            ) : prescriptions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {prescriptions.slice(0, 2).map(rx => <PrescriptionCard key={rx.id} rx={rx} />)}
              </div>
            ) : (
              <div style={{
                background: 'white', borderRadius: '16px', padding: '40px 24px',
                border: '2px dashed #E2E8F0', textAlign: 'center',
              }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', marginBottom: '4px' }}>No prescriptions yet</p>
                <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>Upload a medical report to get started</p>
                <Link href="/patient/upload" style={{ fontSize: '13px', color: '#10B981', fontWeight: '600', textDecoration: 'none' }}>Upload Report →</Link>
              </div>
            )}
          </div>

          {/* Active Order + Recent Reports */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Active Order */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Order Tracker</h2>
                <Link href="/patient/orders" style={{ fontSize: '12px', color: '#10B981', fontWeight: '600', textDecoration: 'none' }}>View all →</Link>
              </div>
              {activeOrder ? (
                <OrderTracker order={activeOrder} />
              ) : (
                <div style={{
                  background: 'white', borderRadius: '16px', padding: '28px 24px',
                  border: '2px dashed #E2E8F0', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚚</div>
                  <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>No active orders</p>
                </div>
              )}
            </div>

            {/* Recent Reports */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Recent Reports</h2>
                <Link href="/patient/reports" style={{ fontSize: '12px', color: '#10B981', fontWeight: '600', textDecoration: 'none' }}>View all →</Link>
              </div>
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #F1F5F9', overflow: 'hidden' }}>
                {reports.length > 0 ? reports.slice(0, 3).map((r, i) => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                    borderBottom: i < Math.min(reports.length, 3) - 1 ? '1px solid #F8FAFC' : 'none',
                    transition: 'background 0.15s', cursor: 'pointer',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                      background: r.processed ? '#ECFDF5' : '#F1F5F9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                    }}>
                      {r.processed ? '🤖' : '📄'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.fileName}</p>
                      <p style={{ fontSize: '11px', color: '#94A3B8', margin: '2px 0 0' }}>{new Date(r.createdAt).toLocaleDateString('en-GB')}</p>
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '20px',
                      background: r.processed ? '#ECFDF5' : '#F1F5F9',
                      color: r.processed ? '#065F46' : '#64748B',
                      flexShrink: 0,
                    }}>
                      {r.processed ? 'Analysed' : 'Processing'}
                    </span>
                  </div>
                )) : (
                  <div style={{ padding: '32px', textAlign: 'center' }}>
                    <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>No reports yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Safety Notice */}
        <div style={{
          background: 'linear-gradient(135deg, #EFF6FF, #F0FDF4)',
          borderRadius: '16px', padding: '20px 24px',
          border: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', gap: '16px',
        }}>
          <div style={{ fontSize: '28px', flexShrink: 0 }}>🛡️</div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#1E3A5F', margin: '0 0 2px' }}>Your data is safe with us</p>
            <p style={{ fontSize: '12px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
              All medical reports are encrypted with AES-256. AI analysis is advisory only — a licensed doctor reviews and approves every prescription before it reaches you.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
