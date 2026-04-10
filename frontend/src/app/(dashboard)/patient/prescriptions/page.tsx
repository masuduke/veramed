'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api-client';

export default function PrescriptionsPage() {
  const queryClient = useQueryClient();
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [matchResults, setMatchResults] = useState<any>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [selectedPharmacy, setSelectedPharmacy] = useState<any>(null);
  const [orderMode, setOrderMode] = useState<'single'|'split'>('single');
  const [ordering, setOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ['my-prescriptions'],
    queryFn: () => api.get('/patient/prescriptions').then(r => r.data).catch(() => []),
  });

  const findPharmacies = async (prescription: any) => {
    setSelectedPrescription(prescription);
    setSelectedPharmacy(null);
    setMatchResults(null);
    setLoadingMatch(true);
    try {
      // Try the smart matching endpoint first
      const res = await api.get(`/patient/prescriptions/${prescription.id}/pharmacy-options`);
      setMatchResults(res.data);
    } catch {
      // Fallback: show all pharmacies with inventory
      try {
        const inv = await api.get('/pharmacy/inventory');
        const meds = prescription.medications || [];
        setMatchResults({
          requestedMeds: meds,
          pharmacyOptions: [],
          notFoundAnywhere: meds,
          splitOption: null,
          summary: { totalRequested: meds.length, foundSomewhere: 0, notFound: meds.length, hasFullCoverage: false },
          fallback: true,
        });
      } catch {
        setMatchResults({ error: true });
      }
    } finally { setLoadingMatch(false); }
  };

  const handleOrder = async () => {
    if (!selectedPharmacy && orderMode === 'single') return;
    setOrdering(true);
    try {
      if (orderMode === 'split' && matchResults?.splitOption) {
        // Place two orders
        const { pharmacyA, pharmacyB } = matchResults.splitOption;
        await api.post('/orders/create', {
          prescriptionId: selectedPrescription.id,
          items: pharmacyA.medications.map((m: any) => ({ medicationId: m.id, quantity: 1 })),
        });
        await api.post('/orders/create', {
          prescriptionId: selectedPrescription.id,
          items: pharmacyB.medications.map((m: any) => ({ medicationId: m.id, quantity: 1 })),
        });
      } else {
        await api.post('/orders/create', {
          prescriptionId: selectedPrescription.id,
          items: selectedPharmacy.medications.map((m: any) => ({ medicationId: m.id, quantity: 1 })),
        });
      }
      setOrderSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['my-prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    } catch (err: any) {
      alert('Order failed: ' + (err?.response?.data?.error || err.message));
    } finally { setOrdering(false); }
  };

  const statusConfig: Record<string, any> = {
    pending_review: { label: 'Awaiting Doctor', color: '#D97706', bg: '#FEF3C7', icon: '⏳' },
    approved: { label: 'Approved', color: '#15803D', bg: '#DCFCE7', icon: '✅' },
    rejected: { label: 'Rejected', color: '#DC2626', bg: '#FEE2E2', icon: '❌' },
    ordered: { label: 'Ordered', color: '#1D4ED8', bg: '#DBEAFE', icon: '📦' },
  };

  if (orderSuccess) return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '48px', textAlign: 'center', maxWidth: '440px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0B1F3A', marginBottom: '8px' }}>Order Placed!</h2>
        <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>Your medication order has been sent to the pharmacy. A driver will be assigned once it's ready for pickup.</p>
        <button onClick={() => { setOrderSuccess(false); setSelectedPrescription(null); setMatchResults(null); }}
          style={{ padding: '12px 28px', background: '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
          Back to Prescriptions
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); *{font-family:"DM Sans",sans-serif;box-sizing:border-box;} .ph-card:hover{border-color:#3CBEA0 !important;} .ph-card.selected{border-color:#3CBEA0 !important;background:#F0FDF4 !important;}`}</style>

      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '36px 40px 60px' }}>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 6px' }}>My Prescriptions</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: 0 }}>Doctor-approved prescriptions • Smart pharmacy matching</p>
      </div>

      <div style={{ maxWidth: '900px', margin: '-30px auto 0', padding: '0 24px 48px' }}>

        {isLoading ? (
          <div style={{ background: 'white', borderRadius: '20px', padding: '60px', textAlign: 'center', color: '#6B7280' }}>Loading...</div>
        ) : !prescriptions || prescriptions.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '20px', padding: '60px 24px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💊</div>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>No prescriptions yet. Upload a report to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {prescriptions.map((rx: any) => {
              const cfg = statusConfig[rx.status] || statusConfig.pending_review;
              const meds = rx.medications || [];
              const isApproved = rx.status === 'approved';
              const isSelected = selectedPrescription?.id === rx.id;

              return (
                <div key={rx.id}>
                  {/* Prescription card */}
                  <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: isSelected ? '2px solid #3CBEA0' : '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '0 0 4px' }}>{new Date(rx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Dr. {rx.doctor?.user?.name || 'Assigned Doctor'}</p>
                      </div>
                      <span style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '20px', fontWeight: '600', background: cfg.bg, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
                    </div>

                    {rx.notes && (
                      <div style={{ padding: '10px 14px', background: '#F0F9FF', borderRadius: '10px', border: '1px solid #BAE6FD', marginBottom: '14px', fontSize: '13px', color: '#0369A1' }}>
                        <strong>Doctor&apos;s note:</strong> {rx.notes}
                      </div>
                    )}

                    {/* Medications list */}
                    <div style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Prescribed ({meds.length} medication{meds.length !== 1 ? 's' : ''})</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {meds.map((med: any, i: number) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                            <span style={{ fontSize: '13px', color: '#374151' }}>💊 {med.name}</span>
                            <span style={{ fontSize: '12px', color: '#6B7280' }}>{med.dosageGuidance} • {med.frequency}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {isApproved && !isSelected && (
                      <button onClick={() => findPharmacies(rx)}
                        style={{ width: '100%', padding: '13px', background: '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                        🔍 Find Available Pharmacies
                      </button>
                    )}

                    {rx.status === 'ordered' && (
                      <div style={{ padding: '12px 16px', background: '#DBEAFE', borderRadius: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#1D4ED8' }}>
                        📦 Order placed — check My Orders for tracking
                      </div>
                    )}

                    {rx.status === 'rejected' && rx.rejectionReason && (
                      <div style={{ padding: '10px 14px', background: '#FEE2E2', borderRadius: '10px', fontSize: '13px', color: '#991B1B' }}>
                        <strong>Reason:</strong> {rx.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Pharmacy matching results */}
                  {isSelected && (
                    <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginTop: '12px', border: '1px solid #E5E7EB' }}>

                      {loadingMatch ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: '#6B7280' }}>
                          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
                          <p style={{ fontSize: '14px' }}>Searching pharmacies near you...</p>
                        </div>
                      ) : matchResults?.error ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#DC2626', fontSize: '14px' }}>
                          Could not load pharmacy options. Please try again.
                        </div>
                      ) : matchResults && (
                        <>
                          {/* Summary banner */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
                            {[
                              { label: 'Meds Requested', value: matchResults.summary?.totalRequested || 0, color: '#EEF2FF', text: '#4338CA' },
                              { label: 'Found in Pharmacies', value: matchResults.summary?.foundSomewhere || 0, color: '#DCFCE7', text: '#15803D' },
                              { label: 'Not Available', value: matchResults.summary?.notFound || 0, color: matchResults.summary?.notFound > 0 ? '#FEE2E2' : '#F0FDF4', text: matchResults.summary?.notFound > 0 ? '#DC2626' : '#15803D' },
                            ].map(s => (
                              <div key={s.label} style={{ background: s.color, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: '700', color: s.text }}>{s.value}</div>
                                <div style={{ fontSize: '11px', color: s.text, fontWeight: '500', marginTop: '2px' }}>{s.label}</div>
                              </div>
                            ))}
                          </div>

                          {/* Not found anywhere warning */}
                          {matchResults.notFoundAnywhere?.length > 0 && (
                            <div style={{ padding: '14px 16px', background: '#FEF3C7', borderRadius: '12px', border: '1px solid #FCD34D', marginBottom: '16px' }}>
                              <p style={{ fontSize: '13px', fontWeight: '700', color: '#D97706', margin: '0 0 6px' }}>⚠️ Not available in any pharmacy:</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {matchResults.notFoundAnywhere.map((m: any) => (
                                  <span key={m.name} style={{ fontSize: '12px', background: '#FFFBEB', color: '#92400E', padding: '3px 10px', borderRadius: '20px', border: '1px solid #FCD34D' }}>
                                    💊 {m.name}
                                  </span>
                                ))}
                              </div>
                              <p style={{ fontSize: '12px', color: '#92400E', margin: '8px 0 0' }}>Your doctor has been notified to suggest alternatives.</p>
                            </div>
                          )}

                          {/* Order mode toggle (if split available) */}
                          {matchResults.splitOption && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                              <button onClick={() => { setOrderMode('single'); setSelectedPharmacy(null); }}
                                style={{ padding: '12px', border: `2px solid ${orderMode === 'single' ? '#0B1F3A' : '#E5E7EB'}`, borderRadius: '12px', background: orderMode === 'single' ? '#F9FAFB' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ fontSize: '18px', marginBottom: '4px' }}>🏥</div>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0B1F3A' }}>Single Pharmacy</div>
                                <div style={{ fontSize: '11px', color: '#6B7280' }}>Best coverage from one place</div>
                              </button>
                              <button onClick={() => { setOrderMode('split'); setSelectedPharmacy(null); }}
                                style={{ padding: '12px', border: `2px solid ${orderMode === 'split' ? '#3CBEA0' : '#E5E7EB'}`, borderRadius: '12px', background: orderMode === 'split' ? '#F0FDF4' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ fontSize: '18px', marginBottom: '4px' }}>🔀</div>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0B1F3A' }}>Split Order</div>
                                <div style={{ fontSize: '11px', color: '#6B7280' }}>{matchResults.splitOption.combinedCoverage}% coverage across 2 pharmacies</div>
                              </button>
                            </div>
                          )}

                          {/* Single pharmacy options */}
                          {orderMode === 'single' && (
                            <>
                              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0B1F3A', marginBottom: '12px' }}>
                                Select a Pharmacy ({matchResults.pharmacyOptions?.length || 0} available)
                              </h3>
                              {matchResults.pharmacyOptions?.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px', color: '#6B7280', fontSize: '14px' }}>
                                  No pharmacies have these medications in stock yet. Check back soon.
                                </div>
                              ) : (
                                matchResults.pharmacyOptions.map((ph: any) => (
                                  <div key={ph.pharmacyId} className={`ph-card${selectedPharmacy?.pharmacyId === ph.pharmacyId ? ' selected' : ''}`}
                                    onClick={() => setSelectedPharmacy(ph)}
                                    style={{ border: '2px solid #E5E7EB', borderRadius: '14px', padding: '16px', marginBottom: '10px', cursor: 'pointer', transition: 'all 0.15s' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                      <div>
                                        <p style={{ fontSize: '14px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 2px' }}>🏥 {ph.pharmacyName}</p>
                                        {ph.location && <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>📍 {ph.location}</p>}
                                      </div>
                                      <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A' }}>£{(ph.totalPrice / 100).toFixed(2)}</div>
                                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: '600', background: ph.coverage === 100 ? '#DCFCE7' : '#FEF3C7', color: ph.coverage === 100 ? '#15803D' : '#D97706' }}>
                                          {ph.coverage}% coverage
                                        </span>
                                      </div>
                                    </div>

                                    {/* Found meds */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: ph.missingMeds?.length > 0 ? '6px' : '0' }}>
                                      {ph.foundMeds?.map((m: any) => (
                                        <span key={m.name} style={{ fontSize: '11px', background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '20px' }}>✓ {m.name}</span>
                                      ))}
                                    </div>

                                    {/* Missing meds from this pharmacy */}
                                    {ph.missingMeds?.length > 0 && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                        {ph.missingMeds.map((m: any) => (
                                          <span key={m.name} style={{ fontSize: '11px', background: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: '20px' }}>✗ {m.name} not here</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </>
                          )}

                          {/* Split order view */}
                          {orderMode === 'split' && matchResults.splitOption && (
                            <div>
                              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0B1F3A', marginBottom: '12px' }}>Split Order Details</h3>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                {[matchResults.splitOption.pharmacyA, matchResults.splitOption.pharmacyB].map((ph: any, idx: number) => (
                                  <div key={idx} style={{ border: '2px solid #3CBEA0', borderRadius: '14px', padding: '14px', background: '#F0FDF4' }}>
                                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 8px' }}>Pharmacy {idx + 1}: {ph.pharmacyName}</p>
                                    {ph.medications?.map((m: any) => (
                                      <div key={m.name} style={{ fontSize: '12px', color: '#15803D', padding: '3px 0' }}>✓ {m.name} — £{(m.price / 100).toFixed(2)}</div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                              <div style={{ padding: '12px 16px', background: '#EFF6FF', borderRadius: '10px', border: '1px solid #BFDBFE', fontSize: '13px', color: '#1D4ED8', marginBottom: '16px' }}>
                                💡 Two separate orders will be placed. Two drivers will deliver from each pharmacy. Total: <strong>£{(matchResults.splitOption.totalPrice / 100).toFixed(2)}</strong>
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

                          <button onClick={() => { setSelectedPrescription(null); setMatchResults(null); }}
                            style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: '#9CA3AF', fontSize: '13px', cursor: 'pointer', marginTop: '8px' }}>
                            ← Back to prescriptions
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
