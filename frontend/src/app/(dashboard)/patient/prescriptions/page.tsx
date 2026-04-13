'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api-client';

const SPECIALTY_LABELS: Record<string, string> = {
  general_medicine: 'General Medicine',
  cardiology: 'Cardiology',
  gynaecology: 'Gynaecology',
  dermatology: 'Dermatology',
  neurology: 'Neurology',
  paediatrics: 'Paediatrics',
  orthopaedics: 'Orthopaedics',
  psychiatry: 'Psychiatry',
  oncology: 'Oncology',
  emergency_medicine: 'Emergency Medicine',
  endocrinology: 'Endocrinology',
  gastroenterology: 'Gastroenterology',
  pulmonology: 'Pulmonology',
  nephrology: 'Nephrology',
  rheumatology: 'Rheumatology',
};

const SPECIALTY_ICONS: Record<string, string> = {
  general_medicine: '🩺', cardiology: '❤️', gynaecology: '🌸',
  dermatology: '🔬', neurology: '🧠', paediatrics: '👶',
  orthopaedics: '🦴', psychiatry: '💆', oncology: '🎗️',
  emergency_medicine: '🚨', endocrinology: '⚗️', gastroenterology: '🫁',
  pulmonology: '🫁', nephrology: '💧', rheumatology: '🦾',
};

export default function PrescriptionsPage() {
  const queryClient = useQueryClient();
  const [selectedRx, setSelectedRx] = useState<any>(null);
  const [pharmacyOptions, setPharmacyOptions] = useState<any>(null);
  const [loadingPharmacy, setLoadingPharmacy] = useState(false);
  const [selectedPharmacy, setSelectedPharmacy] = useState<any>(null);
  const [orderMode, setOrderMode] = useState<'single'|'split'>('single');
  const [ordering, setOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ['my-prescriptions'],
    queryFn: () => api.get('/patient/prescriptions').then(r => r.data).catch(() => []),
    refetchInterval: 30000,
  });

  const findPharmacies = async (rx: any) => {
    setSelectedRx(rx);
    setPharmacyOptions(null);
    setSelectedPharmacy(null);
    setLoadingPharmacy(true);
    try {
      const res = await api.get(`/patient/prescriptions/${rx.id}/pharmacy-options`);
      setPharmacyOptions(res.data);
    } catch {
      setPharmacyOptions({ error: true });
    } finally { setLoadingPharmacy(false); }
  };

  const handleOrder = async () => {
    setOrdering(true);
    try {
      if (orderMode === 'split' && pharmacyOptions?.splitOption) {
        const { pharmacyA, pharmacyB } = pharmacyOptions.splitOption;
        await api.post('/orders/create', {
          prescriptionId: selectedRx.id,
          items: pharmacyA.medications.map((m: any) => ({ medicationId: m.id, quantity: 1 })),
        });
        await api.post('/orders/create', {
          prescriptionId: selectedRx.id,
          items: pharmacyB.medications.map((m: any) => ({ medicationId: m.id, quantity: 1 })),
        });
      } else {
        await api.post('/orders/create', {
          prescriptionId: selectedRx.id,
          items: selectedPharmacy.medications.map((m: any) => ({ medicationId: m.id, quantity: 1 })),
        });
      }
      setOrderSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['my-prescriptions'] });
    } catch (err: any) {
      alert('Order failed: ' + (err?.response?.data?.error || err.message));
    } finally { setOrdering(false); }
  };

  const getOverallStatus = (rx: any) => {
    const statuses = rx.specialtyStatuses || [];
    if (statuses.length === 0) return rx.status;
    if (statuses.every((s: any) => s.status === 'approved')) return 'fully_approved';
    if (statuses.some((s: any) => s.status === 'approved') && statuses.some((s: any) => s.status === 'pending')) return 'partially_approved';
    if (statuses.some((s: any) => s.status === 'rejected')) return 'rejected';
    return 'pending_review';
  };

  const getProgressPct = (rx: any) => {
    const statuses = rx.specialtyStatuses || [];
    if (statuses.length === 0) return rx.status === 'approved' ? 100 : 0;
    const approved = statuses.filter((s: any) => s.status === 'approved').length;
    return Math.round((approved / statuses.length) * 100);
  };

  if (orderSuccess) return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '48px', textAlign: 'center', maxWidth: '440px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0B1F3A', marginBottom: '8px' }}>Order Placed!</h2>
        <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>Your medication has been ordered. A driver will be assigned once the pharmacy prepares it.</p>
        <button onClick={() => { setOrderSuccess(false); setSelectedRx(null); setPharmacyOptions(null); }}
          style={{ padding: '12px 28px', background: '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
          Back to Prescriptions
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { font-family: "DM Sans", sans-serif; box-sizing: border-box; }
        .ph-card { transition: all 0.15s; cursor: pointer; }
        .ph-card:hover { border-color: #3CBEA0 !important; }
        .ph-card.selected { border-color: #3CBEA0 !important; background: #F0FDF4 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '36px 40px 64px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(60,190,160,0.08)' }} />
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 6px' }}>My Prescriptions</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: 0 }}>
          Track specialist approvals • Order medications • Monitor delivery
        </p>
      </div>

      <div style={{ maxWidth: '900px', margin: '-36px auto 0', padding: '0 24px 48px' }}>
        {isLoading ? (
          <div style={{ background: 'white', borderRadius: '20px', padding: '60px', textAlign: 'center', color: '#6B7280', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            Loading prescriptions...
          </div>
        ) : !prescriptions || prescriptions.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '20px', padding: '60px 24px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💊</div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0B1F3A', marginBottom: '8px' }}>No prescriptions yet</h3>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>Upload a medical report to start the process.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {prescriptions.map((rx: any) => {
              const overallStatus = getOverallStatus(rx);
              const progressPct = getProgressPct(rx);
              const specialtyStatuses = rx.specialtyStatuses || [];
              const isSelected = selectedRx?.id === rx.id;
              const canOrderFull = overallStatus === 'fully_approved' || rx.status === 'approved';
              const canOrderPartial = rx.canOrderPartial || overallStatus === 'partially_approved';
              const isOrdered = rx.status === 'ordered';

              return (
                <div key={rx.id}>
                  {/* Main prescription card */}
                  <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: isSelected ? '2px solid #3CBEA0' : '1px solid #F3F4F6' }}>

                    {/* Header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Prescription #{rx.id?.slice(-8).toUpperCase()}
                        </p>
                        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                          {new Date(rx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <span style={{
                        fontSize: '12px', padding: '5px 14px', borderRadius: '20px', fontWeight: '600',
                        background: overallStatus === 'fully_approved' || rx.status === 'approved' ? '#DCFCE7' :
                          overallStatus === 'partially_approved' ? '#EFF6FF' :
                          overallStatus === 'rejected' ? '#FEE2E2' : '#FEF3C7',
                        color: overallStatus === 'fully_approved' || rx.status === 'approved' ? '#15803D' :
                          overallStatus === 'partially_approved' ? '#1D4ED8' :
                          overallStatus === 'rejected' ? '#DC2626' : '#D97706',
                      }}>
                        {overallStatus === 'fully_approved' || rx.status === 'approved' ? '✅ Fully Approved' :
                         overallStatus === 'partially_approved' ? '⚡ Partially Approved' :
                         overallStatus === 'rejected' ? '❌ Rejected' : '⏳ Under Review'}
                      </span>
                    </div>

                    {/* Progress bar */}
                    {specialtyStatuses.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>Approval Progress</span>
                          <span style={{ fontSize: '12px', color: '#3CBEA0', fontWeight: '700' }}>{progressPct}%</span>
                        </div>
                        <div style={{ height: '8px', background: '#F3F4F6', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '4px', width: `${progressPct}%`, background: progressPct === 100 ? '#3CBEA0' : '#3B82F6', transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    )}

                    {/* Per-specialty approval tracker */}
                    {specialtyStatuses.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <p style={{ fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                          Specialist Approvals ({specialtyStatuses.length} required)
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {specialtyStatuses.map((spec: any, idx: number) => (
                            <div key={idx} style={{
                              display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px',
                              borderRadius: '12px', border: '1px solid',
                              borderColor: spec.status === 'approved' ? '#BBF7D0' : spec.status === 'rejected' ? '#FECACA' : '#E5E7EB',
                              background: spec.status === 'approved' ? '#F0FDF4' : spec.status === 'rejected' ? '#FEF2F2' : '#FAFAFA',
                            }}>
                              {/* Specialty icon + name */}
                              <div style={{ flexShrink: 0 }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                                  background: spec.status === 'approved' ? '#DCFCE7' : spec.status === 'rejected' ? '#FEE2E2' : '#F3F4F6' }}>
                                  {SPECIALTY_ICONS[spec.specialty] || '🏥'}
                                </div>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div>
                                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 2px' }}>
                                      {SPECIALTY_LABELS[spec.specialty] || spec.specialty}
                                    </p>
                                    <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 4px' }}>
                                      {spec.status === 'approved' ? `✓ Dr. ${spec.doctorName}` :
                                       spec.status === 'rejected' ? `Rejected by Dr. ${spec.doctorName}` :
                                       spec.doctorName !== 'Unassigned' ? `Dr. ${spec.doctorName} reviewing` : 'Awaiting available specialist'}
                                    </p>
                                    {spec.decidedAt && (
                                      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>
                                        {new Date(spec.decidedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', flexShrink: 0, marginLeft: '8px',
                                    background: spec.status === 'approved' ? '#DCFCE7' : spec.status === 'rejected' ? '#FEE2E2' : '#FEF3C7',
                                    color: spec.status === 'approved' ? '#15803D' : spec.status === 'rejected' ? '#DC2626' : '#D97706' }}>
                                    {spec.status === 'approved' ? '✅ Approved' : spec.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                                  </span>
                                </div>

                                {/* Medications for this specialty */}
                                {spec.medications?.length > 0 && (
                                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {spec.medications.map((m: any, mi: number) => (
                                      <span key={mi} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', fontWeight: '500',
                                        background: spec.status === 'approved' ? 'white' : '#F3F4F6',
                                        color: spec.status === 'approved' ? '#15803D' : '#6B7280',
                                        border: `1px solid ${spec.status === 'approved' ? '#BBF7D0' : '#E5E7EB'}` }}>
                                        💊 {m.name}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Doctor notes */}
                                {spec.notes && (
                                  <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(59,130,246,0.06)', borderRadius: '8px', fontSize: '12px', color: '#1D4ED8', borderLeft: '3px solid #3B82F6' }}>
                                    📝 {spec.notes}
                                  </div>
                                )}

                                {/* Rejection reason */}
                                {spec.rejectionReason && (
                                  <div style={{ marginTop: '8px', padding: '8px 10px', background: '#FEF2F2', borderRadius: '8px', fontSize: '12px', color: '#DC2626', borderLeft: '3px solid #DC2626' }}>
                                    ❌ {spec.rejectionReason}
                                  </div>
                                )}

                                {/* Partial dispense flag */}
                                {spec.safeToDispensePartial && spec.status === 'approved' && (
                                  <div style={{ marginTop: '8px', padding: '6px 10px', background: '#EFF6FF', borderRadius: '8px', fontSize: '11px', color: '#1D4ED8', fontWeight: '600' }}>
                                    ⚡ Doctor flagged: Safe to order these medications now without waiting for other specialists
                                    {spec.partialDispenseNote && <span style={{ fontWeight: '400' }}> — {spec.partialDispenseNote}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Legacy single-doctor prescriptions (no specialty statuses) */}
                    {specialtyStatuses.length === 0 && rx.medications?.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <p style={{ fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Medications</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {rx.medications.map((m: any, i: number) => (
                            <div key={i} style={{ padding: '8px 12px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px', color: '#374151' }}>
                              💊 {m.name} — {m.dosageGuidance} • {m.frequency}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Doctor notes (legacy) */}
                    {rx.doctorNotes && (
                      <div style={{ padding: '10px 14px', background: '#EFF6FF', borderRadius: '10px', border: '1px solid #BFDBFE', marginBottom: '14px', fontSize: '13px', color: '#1D4ED8' }}>
                        <strong>Doctor&apos;s note:</strong> {rx.doctorNotes}
                      </div>
                    )}

                    {/* Partial order notice */}
                    {canOrderPartial && !canOrderFull && !isOrdered && (
                      <div style={{ padding: '12px 16px', background: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE', marginBottom: '14px' }}>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#1D4ED8', margin: '0 0 4px' }}>⚡ Partial Order Available</p>
                        <p style={{ fontSize: '12px', color: '#1D4ED8', margin: 0, lineHeight: 1.5 }}>
                          Some specialists have approved their medications and flagged them as safe to dispense now.
                          You can order the approved medications while waiting for remaining specialist reviews.
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    {(canOrderFull || canOrderPartial) && !isOrdered && !isSelected && (
                      <button onClick={() => findPharmacies(rx)}
                        style={{ width: '100%', padding: '13px', background: canOrderFull ? '#3CBEA0' : '#3B82F6', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                        {canOrderFull ? '🔍 Find Pharmacies & Order' : '⚡ Order Approved Medications Now'}
                      </button>
                    )}

                    {isOrdered && (
                      <div style={{ padding: '12px 16px', background: '#DBEAFE', borderRadius: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#1D4ED8' }}>
                        📦 Order placed — check My Orders for delivery tracking
                      </div>
                    )}

                    {rx.status === 'rejected' && specialtyStatuses.length === 0 && rx.rejectionReason && (
                      <div style={{ padding: '10px 14px', background: '#FEE2E2', borderRadius: '10px', fontSize: '13px', color: '#991B1B' }}>
                        <strong>Reason:</strong> {rx.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Pharmacy matching panel */}
                  {isSelected && (
                    <div style={{ background: 'white', borderRadius: '20px', padding: '24px', marginTop: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #E5E7EB' }}>

                      {loadingPharmacy ? (
                        <div style={{ textAlign: 'center', padding: '32px' }}>
                          <div style={{ width: '32px', height: '32px', border: '3px solid #3CBEA0', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                          <p style={{ color: '#6B7280', fontSize: '14px' }}>Searching pharmacies near you...</p>
                        </div>
                      ) : pharmacyOptions?.error ? (
                        <p style={{ color: '#DC2626', fontSize: '14px', textAlign: 'center', padding: '24px' }}>Could not load pharmacy options. Please try again.</p>
                      ) : pharmacyOptions && (
                        <>
                          {/* Summary */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '20px' }}>
                            {[
                              { label: 'Meds Needed', value: pharmacyOptions.summary?.totalRequested || 0, bg: '#EEF2FF', color: '#4338CA' },
                              { label: 'Found', value: pharmacyOptions.summary?.foundSomewhere || 0, bg: '#DCFCE7', color: '#15803D' },
                              { label: 'Unavailable', value: pharmacyOptions.summary?.notFound || 0, bg: pharmacyOptions.summary?.notFound > 0 ? '#FEE2E2' : '#F0FDF4', color: pharmacyOptions.summary?.notFound > 0 ? '#DC2626' : '#15803D' },
                            ].map(s => (
                              <div key={s.label} style={{ background: s.bg, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: '11px', color: s.color, fontWeight: '500', marginTop: '2px' }}>{s.label}</div>
                              </div>
                            ))}
                          </div>

                          {/* Not found warning */}
                          {pharmacyOptions.notFoundAnywhere?.length > 0 && (
                            <div style={{ padding: '12px 16px', background: '#FEF3C7', borderRadius: '12px', border: '1px solid #FCD34D', marginBottom: '16px' }}>
                              <p style={{ fontSize: '13px', fontWeight: '700', color: '#D97706', margin: '0 0 6px' }}>⚠️ Not available anywhere:</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {pharmacyOptions.notFoundAnywhere.map((m: any) => (
                                  <span key={m.name} style={{ fontSize: '11px', background: '#FFFBEB', color: '#92400E', padding: '2px 8px', borderRadius: '20px', border: '1px solid #FCD34D' }}>💊 {m.name}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Order mode toggle */}
                          {pharmacyOptions.splitOption && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                              <button onClick={() => { setOrderMode('single'); setSelectedPharmacy(null); }}
                                style={{ padding: '12px', border: `2px solid ${orderMode === 'single' ? '#0B1F3A' : '#E5E7EB'}`, borderRadius: '12px', background: orderMode === 'single' ? '#F9FAFB' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ fontSize: '16px', marginBottom: '4px' }}>🏥</div>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0B1F3A' }}>Single Pharmacy</div>
                                <div style={{ fontSize: '11px', color: '#6B7280' }}>Best coverage from one place</div>
                              </button>
                              <button onClick={() => { setOrderMode('split'); setSelectedPharmacy(null); }}
                                style={{ padding: '12px', border: `2px solid ${orderMode === 'split' ? '#3CBEA0' : '#E5E7EB'}`, borderRadius: '12px', background: orderMode === 'split' ? '#F0FDF4' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ fontSize: '16px', marginBottom: '4px' }}>🔀</div>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0B1F3A' }}>Split Order</div>
                                <div style={{ fontSize: '11px', color: '#6B7280' }}>{pharmacyOptions.splitOption.combinedCoverage}% coverage • 2 pharmacies</div>
                              </button>
                            </div>
                          )}

                          {/* Pharmacy list */}
                          {orderMode === 'single' && (
                            <>
                              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0B1F3A', marginBottom: '12px' }}>
                                Select Pharmacy ({pharmacyOptions.pharmacyOptions?.length || 0} available)
                              </h3>
                              {pharmacyOptions.pharmacyOptions?.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#6B7280', fontSize: '14px', padding: '24px' }}>No pharmacies have these medications in stock yet.</p>
                              ) : pharmacyOptions.pharmacyOptions.map((ph: any) => (
                                <div key={ph.pharmacyId}
                                  className={`ph-card${selectedPharmacy?.pharmacyId === ph.pharmacyId ? ' selected' : ''}`}
                                  onClick={() => setSelectedPharmacy(ph)}
                                  style={{ border: '2px solid #E5E7EB', borderRadius: '14px', padding: '14px', marginBottom: '10px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div>
                                      <p style={{ fontSize: '14px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 2px' }}>🏥 {ph.pharmacyName}</p>
                                      {ph.location && <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>📍 {ph.location}</p>}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <p style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 2px' }}>£{(ph.totalPrice / 100).toFixed(2)}</p>
                                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: '600',
                                        background: ph.coverage === 100 ? '#DCFCE7' : '#FEF3C7',
                                        color: ph.coverage === 100 ? '#15803D' : '#D97706' }}>
                                        {ph.coverage}% coverage
                                      </span>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {ph.foundMeds?.map((m: any) => (
                                      <span key={m.name} style={{ fontSize: '11px', background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '20px' }}>✓ {m.name}</span>
                                    ))}
                                    {ph.missingMeds?.map((m: any) => (
                                      <span key={m.name} style={{ fontSize: '11px', background: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: '20px' }}>✗ {m.name}</span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}

                          {/* Split order */}
                          {orderMode === 'split' && pharmacyOptions.splitOption && (
                            <div>
                              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0B1F3A', marginBottom: '12px' }}>Split Order Details</h3>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                {[pharmacyOptions.splitOption.pharmacyA, pharmacyOptions.splitOption.pharmacyB].map((ph: any, idx: number) => (
                                  <div key={idx} style={{ border: '2px solid #3CBEA0', borderRadius: '14px', padding: '14px', background: '#F0FDF4' }}>
                                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 8px' }}>Pharmacy {idx + 1}: {ph.pharmacyName}</p>
                                    {ph.medications?.map((m: any) => (
                                      <div key={m.name} style={{ fontSize: '12px', color: '#15803D', padding: '2px 0' }}>✓ {m.name} — £{(m.price / 100).toFixed(2)}</div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                              <div style={{ padding: '10px 14px', background: '#EFF6FF', borderRadius: '10px', fontSize: '12px', color: '#1D4ED8', marginBottom: '16px' }}>
                                💡 Two separate orders. Total: <strong>£{(pharmacyOptions.splitOption.totalPrice / 100).toFixed(2)}</strong>
                              </div>
                            </div>
                          )}

                          {/* Order button */}
                          {(selectedPharmacy || orderMode === 'split') && (
                            <button onClick={handleOrder} disabled={ordering}
                              style={{ width: '100%', padding: '14px', background: ordering ? '#9CA3AF' : '#3CBEA0', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: ordering ? 'not-allowed' : 'pointer', marginTop: '8px' }}>
                              {ordering ? '⏳ Placing order...' : orderMode === 'split' ? '🛒 Place Split Order' : `🛒 Order from ${selectedPharmacy?.pharmacyName}`}
                            </button>
                          )}

                          <button onClick={() => { setSelectedRx(null); setPharmacyOptions(null); }}
                            style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: '#9CA3AF', fontSize: '13px', cursor: 'pointer', marginTop: '8px' }}>
                            ← Cancel
                          </button>
                        </>
                      )}
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
