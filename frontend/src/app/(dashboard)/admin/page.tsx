'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api-client';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview'|'wallets'|'withdrawals'|'payments'>('overview');
  const [bankEnabled, setBankEnabled] = useState(false);
  const [bankDetails, setBankDetails] = useState({ bankName: '', accountName: '', accountNumber: '', sortCode: '', reference: '' });
  const [savingBank, setSavingBank] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data).catch(() => ({})),
  });

  const { data: walletRequests } = useQuery({
    queryKey: ['admin-wallet-requests'],
    queryFn: () => api.get('/admin/wallet-requests').then(r => r.data).catch(() => []),
    refetchInterval: 30000,
  });

  const { data: withdrawalRequests } = useQuery({
    queryKey: ['admin-withdrawals'],
    queryFn: () => api.get('/admin/withdrawals').then(r => r.data).catch(() => []),
    refetchInterval: 30000,
  });

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then(r => r.data).catch(() => []),
  });

  const pendingWallets = walletRequests?.filter((r: any) => r.status === 'pending') || [];
  const pendingWithdrawals = withdrawalRequests?.filter((r: any) => r.status === 'pending') || [];

  const handleApproveWallet = async (id: string) => {
    try {
      await api.post(`/admin/wallet-requests/${id}/approve`);
      queryClient.invalidateQueries({ queryKey: ['admin-wallet-requests'] });
    } catch (err: any) { alert('Error: ' + (err?.response?.data?.error || err.message)); }
  };

  const handleRejectWallet = async (id: string) => {
    try {
      await api.post(`/admin/wallet-requests/${id}/reject`);
      queryClient.invalidateQueries({ queryKey: ['admin-wallet-requests'] });
    } catch (err: any) { alert('Error: ' + (err?.response?.data?.error || err.message)); }
  };

  const handleApproveWithdrawal = async (id: string) => {
    try {
      await api.post(`/admin/withdrawals/${id}/complete`);
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
    } catch (err: any) { alert('Error: ' + (err?.response?.data?.error || err.message)); }
  };

  const handleSaveBankDetails = async () => {
    setSavingBank(true);
    try {
      await api.post('/admin/payment-methods', { bankTransfer: { enabled: bankEnabled, ...bankDetails } });
      setBankSaved(true);
      setTimeout(() => setBankSaved(false), 3000);
    } catch (err: any) { alert('Error: ' + (err?.response?.data?.error || err.message)); }
    finally { setSavingBank(false); }
  };

  const tabStyle = (t: string) => ({
    padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
    background: activeTab === t ? '#0B1F3A' : 'white', color: activeTab === t ? 'white' : '#6B7280', transition: 'all 0.15s',
  } as React.CSSProperties);

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); *{font-family:"DM Sans",sans-serif;box-sizing:border-box;}`}</style>

      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '32px 40px 64px' }}>
        <p style={{ color: '#3CBEA0', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Admin Panel</p>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 6px' }}>VeraMed Admin</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>Manage users, payments, wallets and withdrawals</p>
      </div>

      <div style={{ maxWidth: '1100px', margin: '-36px auto 0', padding: '0 24px 48px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total Users', value: users?.length || 0, icon: '👥', bg: '#EEF2FF' },
            { label: 'Pending Wallets', value: pendingWallets.length, icon: '💰', bg: '#FEF3C7' },
            { label: 'Pending Withdrawals', value: pendingWithdrawals.length, icon: '🏦', bg: '#FEE2E2' },
            { label: 'Total Orders', value: stats?.totalOrders || 0, icon: '📦', bg: '#F0FDF4' },
            { label: 'Prescriptions', value: stats?.totalPrescriptions || 0, icon: '💊', bg: '#F0F9FF' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', marginBottom: '10px' }}>{s.icon}</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#0B1F3A', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '3px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#E5E7EB', padding: '4px', borderRadius: '14px', width: 'fit-content' }}>
          {[{k:'overview',l:'👥 Users'},{k:'wallets',l:`💰 Wallet Requests ${pendingWallets.length > 0 ? `(${pendingWallets.length})` : ''}`},{k:'withdrawals',l:`🏦 Withdrawals ${pendingWithdrawals.length > 0 ? `(${pendingWithdrawals.length})` : ''}`},{k:'payments',l:'⚙️ Payment Setup'}].map(t => (
            <button key={t.k} style={tabStyle(t.k)} onClick={() => setActiveTab(t.k as any)}>{t.l}</button>
          ))}
        </div>

        {/* USERS */}
        {activeTab === 'overview' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '20px' }}>All Users ({users?.length || 0})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(users || []).map((u: any) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 14px', border: '1px solid #F3F4F6', borderRadius: '12px', background: '#FAFAFA' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                    {u.role === 'doctor' ? '👨‍⚕️' : u.role === 'pharmacy' ? '🏥' : u.role === 'driver' ? '🚗' : u.role === 'admin' ? '⚙️' : '👤'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#111827', margin: '0 0 2px' }}>{u.name}</p>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>{u.email}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', background: '#EEF2FF', color: '#4338CA', textTransform: 'capitalize' }}>{u.role}</span>
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', background: u.status === 'active' ? '#DCFCE7' : '#F3F4F6', color: u.status === 'active' ? '#15803D' : '#6B7280' }}>
                      {u.status || 'active'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WALLET REQUESTS */}
        {activeTab === 'wallets' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Wallet Top-Up Requests</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>Patients requesting bank transfer balance additions. Verify the transfer, then approve.</p>

            {(walletRequests || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280', fontSize: '14px' }}>No wallet requests yet.</div>
            ) : (walletRequests || []).map((req: any) => (
              <div key={req.id} style={{ border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#0B1F3A', margin: '0 0 2px' }}>{req.user?.name || 'Patient'}</p>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 4px' }}>{req.user?.email}</p>
                    <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>Amount: <strong>£{(req.amount / 100).toFixed(2)}</strong></p>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0' }}>Reference: {req.transferReference}</p>
                  </div>
                  <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: '600', background: req.status === 'pending' ? '#FEF3C7' : req.status === 'approved' ? '#DCFCE7' : '#FEE2E2', color: req.status === 'pending' ? '#D97706' : req.status === 'approved' ? '#15803D' : '#DC2626' }}>
                    {req.status}
                  </span>
                </div>
                {req.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleRejectWallet(req.id)} style={{ flex: 1, padding: '9px', border: '1px solid #FECACA', borderRadius: '8px', background: 'white', color: '#DC2626', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                      ❌ Reject
                    </button>
                    <button onClick={() => handleApproveWallet(req.id)} style={{ flex: 2, padding: '9px', border: 'none', borderRadius: '8px', background: '#3CBEA0', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                      ✅ Approve & Add to Wallet
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* WITHDRAWALS */}
        {activeTab === 'withdrawals' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Pharmacy Withdrawal Requests</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>Manually process bank transfers to pharmacy owners, then mark as paid.</p>

            {(withdrawalRequests || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280', fontSize: '14px' }}>No withdrawal requests yet.</div>
            ) : (withdrawalRequests || []).map((req: any) => (
              <div key={req.id} style={{ border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#0B1F3A', margin: '0 0 2px' }}>{req.pharmacy?.name || 'Pharmacy'}</p>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 6px' }}>{req.pharmacy?.email}</p>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 8px' }}>£{(req.amount / 100).toFixed(2)}</p>
                    <div style={{ background: '#F9FAFB', borderRadius: '10px', padding: '10px 14px', fontSize: '12px' }}>
                      <p style={{ margin: '0 0 4px', color: '#374151' }}><strong>Bank:</strong> {req.bankDetails?.bankName}</p>
                      <p style={{ margin: '0 0 4px', color: '#374151' }}><strong>Account Name:</strong> {req.bankDetails?.accountName}</p>
                      <p style={{ margin: '0 0 4px', color: '#374151' }}><strong>Account No:</strong> {req.bankDetails?.accountNumber}</p>
                      <p style={{ margin: 0, color: '#374151' }}><strong>Sort Code:</strong> {req.bankDetails?.sortCode}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: '600', background: req.status === 'pending' ? '#FEF3C7' : '#DCFCE7', color: req.status === 'pending' ? '#D97706' : '#15803D' }}>
                    {req.status}
                  </span>
                </div>
                {req.status === 'pending' && (
                  <button onClick={() => handleApproveWithdrawal(req.id)} style={{ width: '100%', padding: '10px', border: 'none', borderRadius: '8px', background: '#0B1F3A', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    ✅ Mark as Paid — Deduct from Wallet
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* PAYMENT SETUP */}
        {activeTab === 'payments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Stripe */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>💳</div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', margin: 0 }}>Stripe Payments</h3>
                  <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>Card payments via Stripe</p>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '12px', background: '#DCFCE7', color: '#15803D', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' }}>✓ Active</span>
              </div>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>Stripe is configured via your Render environment variables. Update <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>STRIPE_SECRET_KEY</code> and <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>STRIPE_PUBLISHABLE_KEY</code> in Render dashboard to switch to live mode.</p>
            </div>

            {/* Bank Transfer Setup */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🏦</div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', margin: 0 }}>Bank Transfer Setup</h3>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>Your platform bank account details</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>{bankEnabled ? 'Enabled' : 'Disabled'}</span>
                  <button onClick={() => setBankEnabled(!bankEnabled)} style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', background: bankEnabled ? '#3CBEA0' : '#D1D5DB', cursor: 'pointer', position: 'relative' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: bankEnabled ? '21px' : '3px', transition: 'left 0.2s' }} />
                  </button>
                </div>
              </div>

              {bankSaved && <div style={{ padding: '10px 14px', background: '#DCFCE7', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', color: '#15803D' }}>✅ Bank details saved successfully</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Bank Name', key: 'bankName', placeholder: 'e.g. Barclays' },
                  { label: 'Account Name', key: 'accountName', placeholder: 'VeraMed Ltd' },
                  { label: 'Account Number', key: 'accountNumber', placeholder: '8 digit number' },
                  { label: 'Sort Code', key: 'sortCode', placeholder: 'e.g. 20-00-00' },
                  { label: 'Payment Reference', key: 'reference', placeholder: 'e.g. VERAMED or patient email' },
                ].map(f => (
                  <div key={f.key} style={{ gridColumn: f.key === 'reference' ? '1/-1' : 'auto' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                    <input value={(bankDetails as any)[f.key]} onChange={e => setBankDetails({...bankDetails, [f.key]: e.target.value})} placeholder={f.placeholder}
                      style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                  </div>
                ))}
              </div>

              <button onClick={handleSaveBankDetails} disabled={savingBank}
                style={{ padding: '11px 24px', background: savingBank ? '#9CA3AF' : '#0B1F3A', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                {savingBank ? 'Saving...' : '💾 Save Bank Details'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
