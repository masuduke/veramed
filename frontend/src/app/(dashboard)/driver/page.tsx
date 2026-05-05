'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api-client';

export default function DriverDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'deliveries'|'earnings'|'charges'|'withdraw'>('deliveries');
  const [isOnline, setIsOnline] = useState(false);
  const [acceptingLoading, setAcceptingLoading] = useState<string|null>(null);

  // Charge settings state
  const [chargeType, setChargeType] = useState<'fixed'|'per_mile'|'per_km'>('fixed');
  const [baseCharge, setBaseCharge] = useState('3.50');
  const [perMileRate, setPerMileRate] = useState('1.20');
  const [perKmRate, setPerKmRate] = useState('0.75');
  const [multiPickupEnabled, setMultiPickupEnabled] = useState(true);
  const [multiPickupRadius, setMultiPickupRadius] = useState('1');
  const [multiPickupDiscount, setMultiPickupDiscount] = useState('15');
  const [savingCharges, setSavingCharges] = useState(false);
  const [chargesSaved, setChargesSaved] = useState(false);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const { data: deliveries } = useQuery({
    queryKey: ['driver-deliveries'],
    queryFn: () => api.get('/delivery/driver-orders').then(r => r.data).catch(() => []),
    refetchInterval: isOnline ? 15000 : 60000,
  });

  const { data: wallet } = useQuery({
    queryKey: ['driver-wallet'],
    queryFn: () => api.get('/delivery/wallet').then(r => r.data).catch(() => ({ balance: 0, transactions: [], totalEarned: 0, totalDeliveries: 0, thisWeek: 0, thisMonth: 0 })),
    refetchInterval: 30000,
  });

  const { data: nearbyDeliveries } = useQuery({
    queryKey: ['nearby-deliveries'],
    queryFn: () => api.get('/delivery/available').then(r => r.data).catch(() => []),
    enabled: isOnline,
    refetchInterval: 15000,
  });

  const activeDeliveries = deliveries?.filter((d: any) => ['assigned','picked_up','out_for_delivery','in_transit'].includes(d.status)) || [];
  const completedDeliveries = deliveries?.filter((d: any) => ['delivered','completed'].includes(d.status)) || [];
  const available = nearbyDeliveries || [];

  // Wallet values are already in pounds from the backend
  const balance      = Number(wallet?.balance) || 0;
  const totalEarned  = Number(wallet?.totalEarned) || 0;
  const thisWeek     = Number(wallet?.thisWeek) || 0;
  const thisMonth    = Number(wallet?.thisMonth) || 0;

  // Toggle online status — also tells the backend
  const handleToggleOnline = async () => {
    const newState = !isOnline;
    setIsOnline(newState);
    try {
      await api.post('/delivery/driver/online', { isOnline: newState });
    } catch (err: any) {
      // Revert if backend fails
      setIsOnline(!newState);
      alert('Could not update online status: ' + (err?.response?.data?.error || err.message));
    }
  };

  // Group nearby deliveries by proximity for multi-pickup
  const multiPickupGroups = available.reduce((groups: any[], delivery: any) => {
    if (!multiPickupEnabled) return groups.map((g: any) => ({ ...g, deliveries: [...g.deliveries] }));
    const existing = groups.find((g: any) =>
      g.deliveries.some((d: any) => d.pharmacyId === delivery.pharmacyId)
    );
    if (existing) { existing.deliveries.push(delivery); return groups; }
    return [...groups, { pharmacyId: delivery.pharmacyId, pharmacyName: delivery.pharmacyName, deliveries: [delivery] }];
  }, []);

  const handleAccept = async (deliveryId: string) => {
    setAcceptingLoading(deliveryId);
    try {
      await api.post(`/delivery/${deliveryId}/accept`);
      queryClient.invalidateQueries({ queryKey: ['driver-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-deliveries'] });
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.error || err.message));
    } finally { setAcceptingLoading(null); }
  };

  const handleAcceptMulti = async (deliveryIds: string[]) => {
    for (const id of deliveryIds) {
      await api.post(`/delivery/${id}/accept`).catch(() => {});
    }
    queryClient.invalidateQueries({ queryKey: ['driver-deliveries'] });
    queryClient.invalidateQueries({ queryKey: ['nearby-deliveries'] });
  };

  const handleStatusUpdate = async (deliveryId: string, status: string) => {
    try {
      await api.post(`/delivery/${deliveryId}/update-status`, { status });
      queryClient.invalidateQueries({ queryKey: ['driver-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['driver-wallet'] });
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.error || err.message));
    }
  };

  const handleSaveCharges = async () => {
    setSavingCharges(true);
    try {
      await api.post('/delivery/charges', {
        chargeType,
        baseCharge: parseFloat(baseCharge), // pounds
        perMileRate: parseFloat(perMileRate),
        perKmRate: parseFloat(perKmRate),
        multiPickupEnabled,
        multiPickupRadius: parseFloat(multiPickupRadius),
        multiPickupDiscount: parseFloat(multiPickupDiscount),
      });
      setChargesSaved(true);
      setTimeout(() => setChargesSaved(false), 3000);
    } catch (err: any) {
      alert('Error saving: ' + (err?.response?.data?.error || err.message));
    } finally { setSavingCharges(false); }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !bankName || !accountName || !accountNumber) {
      alert('Please fill in all required fields'); return;
    }
    if (parseFloat(withdrawAmount) > balance) {
      alert('Insufficient balance'); return;
    }
    setWithdrawLoading(true);
    try {
      await api.post('/delivery/withdraw', {
        amount: parseFloat(withdrawAmount), // pounds
        bankDetails: { bankName, accountName, accountNumber, sortCode },
      });
      setWithdrawSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['driver-wallet'] });
      setWithdrawAmount(''); setBankName(''); setAccountName(''); setAccountNumber(''); setSortCode('');
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.error || err.message));
    } finally { setWithdrawLoading(false); }
  };

  const tabStyle = (t: string) => ({
    padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: '600', transition: 'all 0.15s',
    background: activeTab === t ? '#0B1F3A' : 'white',
    color: activeTab === t ? 'white' : '#6B7280',
  } as React.CSSProperties);

  const firstName = user?.name?.split(' ')[0] || 'Driver';

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); *{font-family:"DM Sans",sans-serif;box-sizing:border-box;} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '32px 40px 64px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(60,190,160,0.08)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ color: '#3CBEA0', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Driver Portal</p>
            <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 4px' }}>{firstName}</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
              {isOnline ? '🟢 Online — receiving delivery requests' : '⚫ Offline — go online to accept deliveries'}
            </p>
          </div>
          {/* Online toggle */}
          <div onClick={handleToggleOnline} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: isOnline ? 'rgba(60,190,160,0.15)' : 'rgba(255,255,255,0.08)', padding: '12px 20px', borderRadius: '14px', border: `1px solid ${isOnline ? 'rgba(60,190,160,0.4)' : 'rgba(255,255,255,0.12)'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isOnline ? '#3CBEA0' : '#6B7280', animation: isOnline ? 'pulse 2s infinite' : 'none' }} />
            <span style={{ color: isOnline ? '#3CBEA0' : 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: '600' }}>{isOnline ? 'Online' : 'Go Online'}</span>
            <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: isOnline ? '#3CBEA0' : '#374151', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: isOnline ? '23px' : '3px', transition: 'left 0.2s' }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '-36px auto 0', padding: '0 24px 48px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Wallet Balance', value: `£${balance.toFixed(2)}`, icon: '💰', bg: '#EEF2FF', accent: '#4F46E5' },
            { label: 'Total Earned', value: `£${totalEarned.toFixed(2)}`, icon: '📈', bg: '#DCFCE7', accent: '#16A34A' },
            { label: 'Active Jobs', value: activeDeliveries.length, icon: '🚚', bg: '#FEF3C7', accent: '#D97706' },
            { label: 'Deliveries Done', value: wallet?.totalDeliveries || completedDeliveries.length, icon: '✅', bg: '#F0F9FF', accent: '#0284C7' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '12px' }}>{s.icon}</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#0B1F3A', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#E5E7EB', padding: '4px', borderRadius: '14px', width: 'fit-content' }}>
          {[
            { k: 'deliveries', l: '🚚 Deliveries' },
            { k: 'earnings', l: '💰 Earnings' },
            { k: 'charges', l: '⚙️ My Charges' },
            { k: 'withdraw', l: '🏦 Withdraw' },
          ].map(t => (
            <button key={t.k} style={tabStyle(t.k)} onClick={() => setActiveTab(t.k as any)}>{t.l}</button>
          ))}
        </div>

        {/* DELIVERIES TAB */}
        {activeTab === 'deliveries' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Available jobs (when online) */}
            {isOnline && (
              <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', margin: 0 }}>Available Jobs Near You</h2>
                  <span style={{ fontSize: '11px', background: '#DCFCE7', color: '#15803D', padding: '4px 10px', borderRadius: '20px', fontWeight: '600', animation: 'pulse 2s infinite' }}>
                    🔴 Live
                  </span>
                </div>

                {available.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px' }}>
                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>📡</div>
                    <p style={{ color: '#6B7280', fontSize: '14px' }}>Scanning for deliveries... Refreshing every 15 seconds.</p>
                  </div>
                ) : (
                  <>
                    {/* Multi-pickup groups */}
                    {multiPickupEnabled && multiPickupGroups.filter((g: any) => g.deliveries.length > 1).map((group: any, idx: number) => (
                      <div key={idx} style={{ border: '2px solid #3CBEA0', borderRadius: '16px', padding: '16px', marginBottom: '12px', background: '#F0FDF4' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <span style={{ fontSize: '11px', background: '#3CBEA0', color: 'white', padding: '3px 10px', borderRadius: '20px', fontWeight: '700', marginBottom: '6px', display: 'inline-block' }}>
                              🔀 MULTI-PICKUP — {group.deliveries.length} orders from same pharmacy
                            </span>
                            <p style={{ fontSize: '14px', fontWeight: '700', color: '#0B1F3A', margin: '4px 0 2px' }}>🏥 {group.pharmacyName}</p>
                            <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>Within {multiPickupRadius}km radius</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 2px' }}>
                              £{group.deliveries.reduce((s: number, d: any) => s + Number(d.deliveryFee || 0), 0).toFixed(2)}
                            </p>
                            <p style={{ fontSize: '11px', color: '#6B7280', margin: 0 }}>{100 - parseInt(multiPickupDiscount)}% discount applied</p>
                          </div>
                        </div>
                        {group.deliveries.map((d: any, i: number) => (
                          <div key={i} style={{ fontSize: '12px', color: '#374151', padding: '4px 8px', background: 'white', borderRadius: '6px', marginBottom: '4px' }}>
                            📦 Order #{d.orderId?.slice(-6).toUpperCase()} → {d.address}
                          </div>
                        ))}
                        <button onClick={() => handleAcceptMulti(group.deliveries.map((d: any) => d.id))}
                          style={{ width: '100%', marginTop: '10px', padding: '10px', background: '#3CBEA0', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                          ✅ Accept All {group.deliveries.length} Pickups
                        </button>
                      </div>
                    ))}

                    {/* Individual jobs */}
                    {available.map((d: any) => (
                      <div key={d.id} style={{ border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: '600', color: '#0B1F3A', margin: '0 0 2px' }}>Order #{d.orderId?.slice(-6).toUpperCase() || 'NEW'}</p>
                            <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 2px' }}>🏥 Pickup: {d.pharmacyName || 'Pharmacy'}</p>
                            <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>📍 Deliver to: {d.address || 'Patient address'}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '16px', fontWeight: '700', color: '#16A34A', margin: '0 0 2px' }}>£{Number(d.deliveryFee || 2.99).toFixed(2)}</p>
                            <p style={{ fontSize: '11px', color: '#6B7280', margin: 0 }}>{d.distance || '~2'} miles away</p>
                          </div>
                        </div>
                        <button onClick={() => handleAccept(d.id)} disabled={acceptingLoading === d.id}
                          style={{ width: '100%', padding: '9px', background: acceptingLoading === d.id ? '#9CA3AF' : '#0B1F3A', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                          {acceptingLoading === d.id ? 'Accepting...' : '✅ Accept Delivery'}
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Not online prompt */}
            {!isOnline && activeDeliveries.length === 0 && (
              <div style={{ background: 'white', borderRadius: '20px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚗</div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0B1F3A', marginBottom: '8px' }}>You are offline</h3>
                <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '20px' }}>Toggle online above to start receiving delivery requests near you.</p>
                <button onClick={handleToggleOnline} style={{ padding: '12px 28px', background: '#3CBEA0', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                  Go Online Now
                </button>
              </div>
            )}

            {/* Active deliveries */}
            {activeDeliveries.length > 0 && (
              <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>Active Deliveries ({activeDeliveries.length})</h2>
                {activeDeliveries.map((d: any) => (
                  <div key={d.id} style={{ border: '2px solid #FCD34D', borderRadius: '14px', padding: '16px', marginBottom: '12px', background: '#FFFBEB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 4px' }}>Order #{d.order?.id?.slice(-6).toUpperCase()}</p>
                        <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 2px' }}>📍 {d.address}</p>
                        <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>Patient: {d.order?.patient?.user?.name}</p>
                      </div>
                      <span style={{ fontSize: '12px', background: '#FEF3C7', color: '#D97706', padding: '4px 10px', borderRadius: '20px', fontWeight: '600', height: 'fit-content' }}>
                        {d.status === 'assigned' ? '⏳ Go to pharmacy' : (d.status === 'picked_up' || d.status === 'out_for_delivery') ? '🚗 Delivering' : '📦 In progress'}
                      </span>
                    </div>

                    {/* Status update buttons */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {d.status === 'assigned' && (
                        <button onClick={() => handleStatusUpdate(d.id, 'picked_up')}
                          style={{ flex: 1, padding: '10px', background: '#D97706', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                          📦 Picked Up from Pharmacy
                        </button>
                      )}
                      {(d.status === 'picked_up' || d.status === 'out_for_delivery') && (
                        <button onClick={() => handleStatusUpdate(d.id, 'delivered')}
                          style={{ flex: 1, padding: '10px', background: '#16A34A', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                          ✅ Delivered to Patient
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completed history */}
            {completedDeliveries.length > 0 && (
              <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>Recent Completed</h2>
                {completedDeliveries.slice(0, 5).map((d: any) => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: '#374151', margin: '0 0 2px' }}>Order #{d.order?.id?.slice(-6).toUpperCase()}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{new Date(d.updatedAt || d.createdAt).toLocaleDateString('en-GB')}</p>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#16A34A' }}>+£{Number(d.deliveryFee || 2.99).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EARNINGS TAB */}
        {activeTab === 'earnings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'linear-gradient(135deg, #0B1F3A, #1a3a5c)', borderRadius: '20px', padding: '28px', color: 'white' }}>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Available to Withdraw</p>
              <p style={{ fontSize: '42px', fontWeight: '700', margin: '0 0 4px' }}>£{balance.toFixed(2)}</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: '0 0 20px' }}>Total earned all time: £{totalEarned.toFixed(2)}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                {[
                  { label: 'This Week', value: `£${thisWeek.toFixed(2)}` },
                  { label: 'This Month', value: `£${thisMonth.toFixed(2)}` },
                  { label: 'Deliveries', value: wallet?.totalDeliveries || 0 },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>{s.value}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>Earnings History</h2>
              {(wallet?.transactions || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#6B7280', fontSize: '14px' }}>No earnings yet. Complete a delivery to get paid.</div>
              ) : (wallet?.transactions || []).map((t: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: t.type === 'credit' ? '#DCFCE7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                      {t.type === 'credit' ? '↓' : '↑'}
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: '#374151', margin: '0 0 2px' }}>{t.description || 'Delivery payment'}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{new Date(t.createdAt).toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: t.type === 'credit' ? '#16A34A' : '#DC2626', margin: 0 }}>
                    {t.type === 'credit' ? '+' : '-'}£{Number(t.amount).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHARGES TAB */}
        {activeTab === 'charges' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>My Delivery Charges</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>Set how you charge patients. These rates are deducted from their wallet per delivery.</p>

              {chargesSaved && <div style={{ padding: '12px', background: '#DCFCE7', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', color: '#15803D' }}>✅ Charge settings saved</div>}

              {/* Charge type */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Charge Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                  {[
                    { k: 'fixed', label: '📦 Fixed Fee', desc: 'Same charge per delivery' },
                    { k: 'per_mile', label: '🛣️ Per Mile', desc: 'Charge by distance in miles' },
                    { k: 'per_km', label: '📍 Per KM', desc: 'Charge by distance in km' },
                  ].map(opt => (
                    <button key={opt.k} onClick={() => setChargeType(opt.k as any)}
                      style={{ padding: '14px', border: `2px solid ${chargeType === opt.k ? '#0B1F3A' : '#E5E7EB'}`, borderRadius: '12px', background: chargeType === opt.k ? '#F9FAFB' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ fontSize: '16px', marginBottom: '4px' }}>{opt.label.split(' ')[0]}</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0B1F3A' }}>{opt.label.split(' ').slice(1).join(' ')}</div>
                      <div style={{ fontSize: '11px', color: '#6B7280' }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Charge amounts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>
                    {chargeType === 'fixed' ? 'Fixed Charge per Delivery (£)' : 'Base Charge (£)'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: '14px' }}>£</span>
                    <input value={baseCharge} onChange={e => setBaseCharge(e.target.value)} type="number" step="0.50" min="0.50"
                      style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px 10px 28px', fontSize: '14px', outline: 'none' }} />
                  </div>
                </div>
                {chargeType === 'per_mile' && (
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Rate per Mile (£)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: '14px' }}>£</span>
                      <input value={perMileRate} onChange={e => setPerMileRate(e.target.value)} type="number" step="0.10" min="0"
                        style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px 10px 28px', fontSize: '14px', outline: 'none' }} />
                    </div>
                  </div>
                )}
                {chargeType === 'per_km' && (
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Rate per KM (£)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: '14px' }}>£</span>
                      <input value={perKmRate} onChange={e => setPerKmRate(e.target.value)} type="number" step="0.10" min="0"
                        style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px 10px 28px', fontSize: '14px', outline: 'none' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Example calculation */}
              <div style={{ padding: '14px 16px', background: '#F0F9FF', borderRadius: '12px', border: '1px solid #BAE6FD', marginBottom: '24px' }}>
                <p style={{ fontSize: '12px', fontWeight: '700', color: '#0369A1', marginBottom: '6px' }}>💡 Example charges:</p>
                {chargeType === 'fixed' && <p style={{ fontSize: '13px', color: '#0369A1', margin: 0 }}>Every delivery → <strong>£{parseFloat(baseCharge || '0').toFixed(2)}</strong></p>}
                {chargeType === 'per_mile' && (
                  <>
                    <p style={{ fontSize: '13px', color: '#0369A1', margin: '0 0 4px' }}>2 miles → <strong>£{(parseFloat(baseCharge || '0') + 2 * parseFloat(perMileRate || '0')).toFixed(2)}</strong></p>
                    <p style={{ fontSize: '13px', color: '#0369A1', margin: 0 }}>5 miles → <strong>£{(parseFloat(baseCharge || '0') + 5 * parseFloat(perMileRate || '0')).toFixed(2)}</strong></p>
                  </>
                )}
                {chargeType === 'per_km' && (
                  <>
                    <p style={{ fontSize: '13px', color: '#0369A1', margin: '0 0 4px' }}>3 km → <strong>£{(parseFloat(baseCharge || '0') + 3 * parseFloat(perKmRate || '0')).toFixed(2)}</strong></p>
                    <p style={{ fontSize: '13px', color: '#0369A1', margin: 0 }}>8 km → <strong>£{(parseFloat(baseCharge || '0') + 8 * parseFloat(perKmRate || '0')).toFixed(2)}</strong></p>
                  </>
                )}
              </div>

              {/* Multi-pickup settings */}
              <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 2px' }}>🔀 Multi-Pickup Mode</p>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>Accept multiple orders from the same pharmacy area</p>
                  </div>
                  <button onClick={() => setMultiPickupEnabled(!multiPickupEnabled)}
                    style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: multiPickupEnabled ? '#3CBEA0' : '#D1D5DB', cursor: 'pointer', position: 'relative' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: multiPickupEnabled ? '23px' : '3px', transition: 'left 0.2s' }} />
                  </button>
                </div>
                {multiPickupEnabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '14px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Pickup radius (km)</label>
                      <input value={multiPickupRadius} onChange={e => setMultiPickupRadius(e.target.value)} type="number" step="0.5" min="0.5" max="5"
                        style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', outline: 'none' }} />
                      <p style={{ fontSize: '11px', color: '#6B7280', margin: '4px 0 0' }}>Group pickups within this radius</p>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Discount per extra order (%)</label>
                      <input value={multiPickupDiscount} onChange={e => setMultiPickupDiscount(e.target.value)} type="number" step="5" min="0" max="50"
                        style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', outline: 'none' }} />
                      <p style={{ fontSize: '11px', color: '#6B7280', margin: '4px 0 0' }}>You earn more, patients pay less</p>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={handleSaveCharges} disabled={savingCharges}
                style={{ padding: '12px 28px', background: savingCharges ? '#9CA3AF' : '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                {savingCharges ? 'Saving...' : '💾 Save Charge Settings'}
              </button>
            </div>
          </div>
        )}

        {/* WITHDRAW TAB */}
        {activeTab === 'withdraw' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Withdraw Earnings</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>Enter your bank details. Admin will manually transfer and mark as paid within 2-3 business days.</p>

            {withdrawSuccess && (
              <div style={{ padding: '14px', background: '#DCFCE7', borderRadius: '12px', border: '1px solid #BBF7D0', marginBottom: '20px', fontSize: '13px', color: '#15803D', fontWeight: '500' }}>
                ✅ Withdrawal request submitted! You will receive payment within 2-3 business days.
              </div>
            )}

            <div style={{ padding: '16px', background: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE', marginBottom: '24px' }}>
              <p style={{ fontSize: '13px', color: '#1D4ED8', margin: 0 }}>
                💰 Available balance: <strong>£{balance.toFixed(2)}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Withdrawal Amount (£) *</label>
                <input value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} type="number" step="0.01" max={balance}
                  placeholder={`Max £${balance.toFixed(2)}`}
                  style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', outline: 'none' }} />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {[10, 25, 50].map(a => (
                    <button key={a} onClick={() => setWithdrawAmount(Math.min(a, balance).toString())}
                      style={{ padding: '5px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', background: 'white', color: '#374151', fontSize: '12px', cursor: 'pointer' }}>£{a}</button>
                  ))}
                  <button onClick={() => setWithdrawAmount(balance.toString())}
                    style={{ padding: '5px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', background: 'white', color: '#374151', fontSize: '12px', cursor: 'pointer' }}>All</button>
                </div>
              </div>

              <div style={{ height: '1px', background: '#F3F4F6' }} />
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Bank Details</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Account Name *', value: accountName, setter: setAccountName, placeholder: 'Full name on account' },
                  { label: 'Bank Name *', value: bankName, setter: setBankName, placeholder: 'e.g. Barclays' },
                  { label: 'Account Number *', value: accountNumber, setter: setAccountNumber, placeholder: '8 digits' },
                  { label: 'Sort Code', value: sortCode, setter: setSortCode, placeholder: 'e.g. 20-00-00' },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                    <input value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder}
                      style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                  </div>
                ))}
              </div>

              <div style={{ padding: '12px 14px', background: '#FFFBEB', borderRadius: '10px', border: '1px solid #FCD34D', fontSize: '12px', color: '#92400E', lineHeight: 1.6 }}>
                ⚠️ Admin will verify and manually transfer to your bank account. Your wallet balance will be reduced once the withdrawal is processed and marked as paid.
              </div>

              <button onClick={handleWithdraw} disabled={withdrawLoading}
                style={{ padding: '13px', background: withdrawLoading ? '#9CA3AF' : '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: withdrawLoading ? 'not-allowed' : 'pointer' }}>
                {withdrawLoading ? '⏳ Submitting...' : '🏦 Submit Withdrawal Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
