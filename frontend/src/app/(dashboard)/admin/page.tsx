'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api-client';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview'|'users'|'wallets'|'withdrawals'|'payments'|'analytics'|'audit'|'notifications'|'verifications'|'refunds'>('overview');
  const [bankEnabled, setBankEnabled] = useState(false);
  const [bankDetails, setBankDetails] = useState({ bankName: '', accountName: '', accountNumber: '', sortCode: '', reference: '' });
  const [savingBank, setSavingBank] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifTarget, setNotifTarget] = useState('all');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifSent, setNotifSent] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data).catch(() => ({})),
    refetchInterval: 60000,
  });

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then(r => r.data).catch(() => []),
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

  const { data: auditLogs } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => api.get('/admin/audit-logs').then(r => r.data).catch(() => []),
    enabled: activeTab === 'audit',
  });

  const { data: refunds } = useQuery({
    queryKey: ['admin-refunds'],
    queryFn: () => api.get('/admin/refunds').then(r => r.data).catch(() => []),
    enabled: activeTab === 'refunds',
  });

  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => api.get('/admin/analytics').then(r => r.data).catch(() => ({
      revenue: { today: 0, week: 0, month: 0, total: 0 },
      orders: { today: 0, week: 0, month: 0, total: 0 },
      users: { patients: 0, doctors: 0, pharmacies: 0, drivers: 0 },
      prescriptions: { pending: 0, approved: 0, rejected: 0, total: 0 },
      deliveries: { active: 0, completed: 0, total: 0 },
      topMedications: [],
    })),
    enabled: activeTab === 'analytics' || activeTab === 'overview',
  });

  const pendingWallets = walletRequests?.filter((r: any) => r.status === 'pending') || [];
  const pendingWithdrawals = withdrawalRequests?.filter((r: any) => r.status === 'pending') || [];

  const filteredUsers = (users || []).filter((u: any) => {
    const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const matchSearch = !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase());
    return matchRole && matchSearch;
  });

  const handleVerifyUser = async (id: string, action: 'verify'|'suspend') => {
    try {
      await api.patch(`/admin/users/${id}/verify`, { status: action === 'verify' ? 'verified' : 'suspended' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err: any) { alert('Error: ' + (err?.response?.data?.error || err.message)); }
  };

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

  const handleCompleteWithdrawal = async (id: string) => {
    try {
      await api.post(`/admin/withdrawals/${id}/complete`);
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
    } catch (err: any) { alert('Error: ' + (err?.response?.data?.error || err.message)); }
  };

  const handleProcessRefund = async (id: string) => {
    try {
      await api.post(`/admin/refunds/${id}/process`);
      queryClient.invalidateQueries({ queryKey: ['admin-refunds'] });
    } catch (err: any) { alert('Error: ' + (err?.response?.data?.error || err.message)); }
  };

  const handleSendNotification = async () => {
    if (!notifTitle || !notifMessage) { alert('Please fill in title and message'); return; }
    setSendingNotif(true);
    try {
      await api.post('/admin/notifications/broadcast', { title: notifTitle, message: notifMessage, target: notifTarget });
      setNotifSent(true);
      setNotifTitle(''); setNotifMessage('');
      setTimeout(() => setNotifSent(false), 4000);
    } catch (err: any) { alert('Error: ' + (err?.response?.data?.error || err.message)); }
    finally { setSendingNotif(false); }
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

  const rev = analytics?.revenue || {};
  const ord = analytics?.orders || {};
  const usr = analytics?.users || {};
  const prx = analytics?.prescriptions || {};

  const tabStyle = (t: string) => ({
    padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
    fontSize: '12px', fontWeight: '600', transition: 'all 0.15s', whiteSpace: 'nowrap' as const,
    background: activeTab === t ? '#0B1F3A' : 'transparent',
    color: activeTab === t ? 'white' : '#6B7280',
  });

  const TABS = [
    { k: 'overview', l: '⊞ Overview' },
    { k: 'analytics', l: '📊 Analytics' },
    { k: 'users', l: `👥 Users${users?.length ? ` (${users.length})` : ''}` },
    { k: 'wallets', l: `💰 Wallets${pendingWallets.length ? ` (${pendingWallets.length})` : ''}` },
    { k: 'withdrawals', l: `🏦 Withdrawals${pendingWithdrawals.length ? ` (${pendingWithdrawals.length})` : ''}` },
    { k: 'refunds', l: '↩️ Refunds' },
    { k: 'audit', l: '📋 Audit Log' },
    { k: 'notifications', l: '📢 Broadcast' },
    { k: 'payments', l: '⚙️ Payments' },
          { k: 'verifications', l: '🔍 Verifications' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); *{font-family:"DM Sans",sans-serif;box-sizing:border-box;}`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '28px 40px 56px' }}>
        <p style={{ color: '#3CBEA0', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Admin Panel</p>
        <h1 style={{ color: 'white', fontSize: '26px', fontWeight: '700', margin: '0 0 4px' }}>VeraMed Control Centre</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', margin: 0 }}>Manage users, payments, prescriptions and platform operations</p>
      </div>

      <div style={{ maxWidth: '1200px', margin: '-30px auto 0', padding: '0 24px 48px' }}>

        {/* Quick stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total Users', value: users?.length || 0, icon: '👥', bg: '#EEF2FF' },
            { label: 'Pending Wallets', value: pendingWallets.length, icon: '💰', bg: pendingWallets.length ? '#FEF3C7' : '#F9FAFB' },
            { label: 'Withdrawals', value: pendingWithdrawals.length, icon: '🏦', bg: pendingWithdrawals.length ? '#FEE2E2' : '#F9FAFB' },
            { label: "Today's Revenue", value: `£${((rev.today || 0) / 100).toFixed(2)}`, icon: '💷', bg: '#DCFCE7' },
            { label: 'Active Orders', value: ord.today || 0, icon: '📦', bg: '#F0F9FF' },
            { label: 'Pending Rx', value: prx.pending || 0, icon: '💊', bg: '#F5F3FF' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', marginBottom: '10px' }}>{s.icon}</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#0B1F3A', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '3px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'white', padding: '6px', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
          {TABS.map(t => <button key={t.k} style={tabStyle(t.k)} onClick={() => setActiveTab(t.k as any)}>{t.l}</button>)}
        </div>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Revenue */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>💷 Revenue</h3>
              {[{ l: 'Today', v: rev.today }, { l: 'This Week', v: rev.week }, { l: 'This Month', v: rev.month }, { l: 'All Time', v: rev.total }].map(r => (
                <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>{r.l}</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#0B1F3A' }}>£{((r.v || 0) / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Users breakdown */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>👥 User Breakdown</h3>
              {[
                { l: 'Patients', v: usr.patients || 0, icon: '🧑', color: '#4F46E5' },
                { l: 'Doctors', v: usr.doctors || 0, icon: '👨‍⚕️', color: '#0284C7' },
                { l: 'Pharmacies', v: usr.pharmacies || 0, icon: '🏥', color: '#D97706' },
                { l: 'Drivers', v: usr.drivers || 0, icon: '🚗', color: '#16A34A' },
              ].map(u => (
                <div key={u.l} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: '16px' }}>{u.icon}</span>
                  <span style={{ fontSize: '13px', color: '#374151', flex: 1 }}>{u.l}</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: u.color }}>{u.v}</span>
                </div>
              ))}
            </div>

            {/* Prescriptions */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>💊 Prescriptions</h3>
              {[
                { l: 'Pending Review', v: prx.pending || 0, bg: '#FEF3C7', color: '#D97706' },
                { l: 'Approved', v: prx.approved || 0, bg: '#DCFCE7', color: '#15803D' },
                { l: 'Rejected', v: prx.rejected || 0, bg: '#FEE2E2', color: '#DC2626' },
                { l: 'Total', v: prx.total || 0, bg: '#EEF2FF', color: '#4F46E5' },
              ].map(p => (
                <div key={p.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>{p.l}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', background: p.bg, color: p.color, padding: '3px 10px', borderRadius: '20px' }}>{p.v}</span>
                </div>
              ))}
            </div>

            {/* Pending actions */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>⚡ Actions Needed</h3>
              {[
                { l: 'Wallet top-up requests', v: pendingWallets.length, tab: 'wallets', urgent: pendingWallets.length > 0 },
                { l: 'Withdrawal requests', v: pendingWithdrawals.length, tab: 'withdrawals', urgent: pendingWithdrawals.length > 0 },
                { l: 'Unverified users', v: (users || []).filter((u: any) => !u.emailVerified && (u.role === 'doctor' || u.role === 'pharmacy')).length, tab: 'users', urgent: false },
              ].map(a => (
                <div key={a.l} onClick={() => setActiveTab(a.tab as any)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '10px', marginBottom: '8px', background: a.urgent && a.v > 0 ? '#FEF3C7' : '#F9FAFB', cursor: 'pointer', border: a.urgent && a.v > 0 ? '1px solid #FCD34D' : '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: '13px', color: '#374151' }}>{a.l}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: a.urgent && a.v > 0 ? '#D97706' : '#9CA3AF' }}>{a.v} pending →</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ANALYTICS */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
              {[
                { label: "Today's Revenue", value: `£${((rev.today||0)/100).toFixed(2)}`, sub: `Week: £${((rev.week||0)/100).toFixed(2)}`, icon: '💷', bg: '#DCFCE7', color: '#15803D' },
                { label: 'Monthly Revenue', value: `£${((rev.month||0)/100).toFixed(2)}`, sub: `Total: £${((rev.total||0)/100).toFixed(2)}`, icon: '📈', bg: '#EEF2FF', color: '#4F46E5' },
                { label: 'Orders Today', value: ord.today || 0, sub: `Month: ${ord.month || 0}`, icon: '📦', bg: '#F0F9FF', color: '#0284C7' },
                { label: 'Total Deliveries', value: analytics?.deliveries?.total || 0, sub: `Active: ${analytics?.deliveries?.active || 0}`, icon: '🚚', bg: '#FEF3C7', color: '#D97706' },
              ].map(s => (
                <div key={s.label} style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '12px' }}>{s.icon}</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: s.color, marginBottom: '2px' }}>{s.value}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{s.sub}</div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* User growth */}
              <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>👥 User Growth</h3>
                {[
                  { role: 'Patients', count: usr.patients || 0, color: '#4F46E5', pct: Math.round(((usr.patients||0) / Math.max(users?.length||1, 1)) * 100) },
                  { role: 'Doctors', count: usr.doctors || 0, color: '#0284C7', pct: Math.round(((usr.doctors||0) / Math.max(users?.length||1, 1)) * 100) },
                  { role: 'Pharmacies', count: usr.pharmacies || 0, color: '#D97706', pct: Math.round(((usr.pharmacies||0) / Math.max(users?.length||1, 1)) * 100) },
                  { role: 'Drivers', count: usr.drivers || 0, color: '#16A34A', pct: Math.round(((usr.drivers||0) / Math.max(users?.length||1, 1)) * 100) },
                ].map(u => (
                  <div key={u.role} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#374151', fontWeight: '500' }}>{u.role}</span>
                      <span style={{ fontSize: '12px', color: '#6B7280' }}>{u.count}</span>
                    </div>
                    <div style={{ height: '6px', background: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: u.color, borderRadius: '3px', width: `${u.pct}%`, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Prescription funnel */}
              <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>💊 Prescription Funnel</h3>
                {[
                  { label: 'Submitted', value: prx.total || 0, color: '#6366F1', width: 100 },
                  { label: 'Pending Review', value: prx.pending || 0, color: '#D97706', width: prx.total ? Math.round((prx.pending / prx.total) * 100) : 0 },
                  { label: 'Approved', value: prx.approved || 0, color: '#16A34A', width: prx.total ? Math.round((prx.approved / prx.total) * 100) : 0 },
                  { label: 'Rejected', value: prx.rejected || 0, color: '#DC2626', width: prx.total ? Math.round((prx.rejected / prx.total) * 100) : 0 },
                ].map(p => (
                  <div key={p.label} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#374151', fontWeight: '500' }}>{p.label}</span>
                      <span style={{ fontSize: '12px', color: '#6B7280' }}>{p.value}</span>
                    </div>
                    <div style={{ height: '6px', background: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: p.color, borderRadius: '3px', width: `${p.width}%`, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top medications */}
            {analytics?.topMedications?.length > 0 && (
              <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>💊 Top Prescribed Medications</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px' }}>
                  {analytics.topMedications.slice(0,5).map((med: any, i: number) => (
                    <div key={i} style={{ background: '#F9FAFB', borderRadius: '12px', padding: '14px', textAlign: 'center', border: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: '20px', marginBottom: '6px' }}>💊</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0B1F3A', marginBottom: '2px' }}>{med.name}</div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>{med.count} times</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* USERS */}
        {activeTab === 'users' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name or email..."
                style={{ flex: 1, minWidth: '200px', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '9px 14px', fontSize: '13px', outline: 'none' }} />
              <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)}
                style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '9px 14px', fontSize: '13px', outline: 'none', background: 'white' }}>
                <option value="all">All Roles</option>
                <option value="patient">Patients</option>
                <option value="doctor">Doctors</option>
                <option value="pharmacy">Pharmacies</option>
                <option value="driver">Drivers</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            <div style={{ marginBottom: '12px', fontSize: '13px', color: '#6B7280' }}>{filteredUsers.length} users shown</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredUsers.map((u: any) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', border: '1px solid #F3F4F6', borderRadius: '12px', background: '#FAFAFA' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                    {u.role === 'doctor' ? '👨‍⚕️' : u.role === 'pharmacy' ? '🏥' : u.role === 'driver' ? '🚗' : u.role === 'admin' ? '⚙️' : '👤'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#111827', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{u.email}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', fontWeight: '600', background: '#EEF2FF', color: '#4338CA', textTransform: 'capitalize' }}>{u.role}</span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', fontWeight: '600', background: u.status === 'active' ? '#DCFCE7' : u.status === 'suspended' ? '#FEE2E2' : '#FEF3C7', color: u.status === 'active' ? '#15803D' : u.status === 'suspended' ? '#DC2626' : '#D97706' }}>
                      {u.status || 'pending'}
                    </span>
                    {u.role !== 'admin' && u.role !== 'patient' && (
                      <>
                        {u.status !== 'active' && (
                          <button onClick={() => handleVerifyUser(u.id, 'verify')} style={{ padding: '4px 10px', background: '#DCFCE7', color: '#15803D', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                            Verify
                          </button>
                        )}
                        {u.status === 'active' && (
                          <button onClick={() => handleVerifyUser(u.id, 'suspend')} style={{ padding: '4px 10px', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                            Suspend
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WALLET REQUESTS */}
        {activeTab === 'wallets' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Patient Wallet Top-Up Requests</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>Patients requesting bank transfer balance additions. Verify the transfer then approve.</p>
            {(walletRequests || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
                <p style={{ fontSize: '14px' }}>No pending wallet requests.</p>
              </div>
            ) : (walletRequests || []).map((req: any) => (
              <div key={req.id} style={{ border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#0B1F3A', margin: '0 0 2px' }}>{req.user?.name || 'Patient'}</p>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 4px' }}>{req.user?.email}</p>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 2px' }}>£{(req.amount / 100).toFixed(2)}</p>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>Reference: <strong>{req.transferReference}</strong></p>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0' }}>{new Date(req.createdAt).toLocaleDateString('en-GB')}</p>
                  </div>
                  <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: '600', background: req.status === 'pending' ? '#FEF3C7' : req.status === 'approved' ? '#DCFCE7' : '#FEE2E2', color: req.status === 'pending' ? '#D97706' : req.status === 'approved' ? '#15803D' : '#DC2626' }}>
                    {req.status}
                  </span>
                </div>
                {req.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleRejectWallet(req.id)} style={{ flex: 1, padding: '9px', border: '1px solid #FECACA', borderRadius: '8px', background: 'white', color: '#DC2626', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>❌ Reject</button>
                    <button onClick={() => handleApproveWallet(req.id)} style={{ flex: 2, padding: '9px', border: 'none', borderRadius: '8px', background: '#3CBEA0', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>✅ Approve & Add to Wallet</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* WITHDRAWALS */}
        {activeTab === 'withdrawals' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Withdrawal Requests</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>Pharmacy owners and drivers requesting bank transfers. Process manually then mark as paid.</p>
            {(withdrawalRequests || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
                <p style={{ fontSize: '14px' }}>No pending withdrawals.</p>
              </div>
            ) : (withdrawalRequests || []).map((req: any) => (
              <div key={req.id} style={{ border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: '#0B1F3A', margin: 0 }}>{req.user?.name || req.pharmacy?.name || 'User'}</p>
                      <span style={{ fontSize: '11px', background: '#EEF2FF', color: '#4338CA', padding: '2px 8px', borderRadius: '10px', fontWeight: '600', textTransform: 'capitalize' }}>{req.userRole || 'pharmacy'}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 8px' }}>{req.user?.email || req.pharmacy?.email}</p>
                    <p style={{ fontSize: '18px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 10px' }}>£{(req.amount / 100).toFixed(2)}</p>
                    <div style={{ background: '#F9FAFB', borderRadius: '10px', padding: '12px', fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div><span style={{ color: '#6B7280' }}>Bank: </span><strong>{req.bankDetails?.bankName}</strong></div>
                      <div><span style={{ color: '#6B7280' }}>Account Name: </span><strong>{req.bankDetails?.accountName}</strong></div>
                      <div><span style={{ color: '#6B7280' }}>Account No: </span><strong>{req.bankDetails?.accountNumber}</strong></div>
                      <div><span style={{ color: '#6B7280' }}>Sort Code: </span><strong>{req.bankDetails?.sortCode}</strong></div>
                    </div>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '8px 0 0' }}>Requested: {new Date(req.createdAt).toLocaleDateString('en-GB')}</p>
                  </div>
                  <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: '600', marginLeft: '12px', background: req.status === 'pending' ? '#FEF3C7' : '#DCFCE7', color: req.status === 'pending' ? '#D97706' : '#15803D' }}>
                    {req.status}
                  </span>
                </div>
                {req.status === 'pending' && (
                  <button onClick={() => handleCompleteWithdrawal(req.id)} style={{ width: '100%', padding: '11px', border: 'none', borderRadius: '10px', background: '#0B1F3A', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    ✅ Mark as Paid — Deduct from Wallet
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* REFUNDS */}
        {activeTab === 'refunds' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Refund Requests</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>Patient refund requests for failed or incorrect orders.</p>
            {(refunds || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>↩️</div>
                <p style={{ fontSize: '14px' }}>No refund requests yet.</p>
              </div>
            ) : (refunds || []).map((r: any) => (
              <div key={r.id} style={{ border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#0B1F3A', margin: '0 0 2px' }}>{r.patient?.user?.name}</p>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 4px' }}>Order #{r.orderId?.slice(-6).toUpperCase()}</p>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: '#DC2626', margin: '0 0 4px' }}>£{(r.amount / 100).toFixed(2)}</p>
                    <p style={{ fontSize: '12px', color: '#374151', margin: 0 }}>Reason: {r.reason}</p>
                  </div>
                  <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: '600', background: r.status === 'pending' ? '#FEF3C7' : '#DCFCE7', color: r.status === 'pending' ? '#D97706' : '#15803D' }}>
                    {r.status}
                  </span>
                </div>
                {r.status === 'pending' && (
                  <button onClick={() => handleProcessRefund(r.id)} style={{ width: '100%', padding: '10px', border: 'none', borderRadius: '10px', background: '#DC2626', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    ↩️ Process Refund — Return to Patient Wallet
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* AUDIT LOG */}
        {activeTab === 'audit' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Prescription Audit Log</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>Immutable log of every prescription approval, rejection and modification.</p>
            {(auditLogs || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📋</div>
                <p style={{ fontSize: '14px' }}>No audit entries yet.</p>
              </div>
            ) : (auditLogs || []).map((log: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '14px', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: log.action?.includes('approve') ? '#DCFCE7' : log.action?.includes('reject') ? '#FEE2E2' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                  {log.action?.includes('approve') ? '✅' : log.action?.includes('reject') ? '❌' : '📝'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: '#0B1F3A', margin: '0 0 2px' }}>{log.action?.replace(/_/g, ' ').toUpperCase()}</p>
                      <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 2px' }}>By: {log.user?.name || log.userId} ({log.user?.role})</p>
                      {log.resourceId && <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0, fontFamily: 'monospace' }}>Resource: {log.resourceId}</p>}
                    </div>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0, flexShrink: 0, marginLeft: '12px' }}>{new Date(log.createdAt).toLocaleString('en-GB')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Broadcast Notification</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>Send a message to all users or a specific role group.</p>

            {notifSent && (
              <div style={{ padding: '14px', background: '#DCFCE7', borderRadius: '12px', border: '1px solid #BBF7D0', marginBottom: '20px', fontSize: '13px', color: '#15803D', fontWeight: '500' }}>
                ✅ Notification sent successfully to {notifTarget === 'all' ? 'all users' : `all ${notifTarget}s`}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Target Audience</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['all','patient','doctor','pharmacy','driver'].map(t => (
                    <button key={t} onClick={() => setNotifTarget(t)}
                      style={{ padding: '8px 16px', border: `2px solid ${notifTarget === t ? '#0B1F3A' : '#E5E7EB'}`, borderRadius: '10px', background: notifTarget === t ? '#0B1F3A' : 'white', color: notifTarget === t ? 'white' : '#6B7280', fontSize: '13px', fontWeight: '500', cursor: 'pointer', textTransform: 'capitalize' }}>
                      {t === 'all' ? '👥 Everyone' : t === 'patient' ? '👤 Patients' : t === 'doctor' ? '👨‍⚕️ Doctors' : t === 'pharmacy' ? '🏥 Pharmacies' : '🚗 Drivers'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Notification Title *</label>
                <input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="e.g. Platform Maintenance Notice"
                  style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', outline: 'none' }} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Message *</label>
                <textarea value={notifMessage} onChange={e => setNotifMessage(e.target.value)} rows={4}
                  style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', resize: 'none', outline: 'none', lineHeight: 1.6 }}
                  placeholder="Write your message here..." />
                <div style={{ textAlign: 'right', fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>{notifMessage.length} characters</div>
              </div>

              <div style={{ padding: '14px 16px', background: '#FFFBEB', borderRadius: '12px', border: '1px solid #FCD34D', fontSize: '13px', color: '#92400E' }}>
                ⚠️ This will send a notification to {notifTarget === 'all' ? `all ${users?.length || 0} users` : `all ${notifTarget}s`} on the platform. This action cannot be undone.
              </div>

              <button onClick={handleSendNotification} disabled={sendingNotif || !notifTitle || !notifMessage}
                style={{ padding: '13px', background: !notifTitle || !notifMessage ? '#9CA3AF' : '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: !notifTitle || !notifMessage ? 'not-allowed' : 'pointer' }}>
                {sendingNotif ? '⏳ Sending...' : `📢 Send to ${notifTarget === 'all' ? 'Everyone' : notifTarget + 's'}`}
              </button>
            </div>
          </div>
        )}

        {/* PAYMENT SETUP */}
        {activeTab === 'payments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>💳</div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', margin: 0 }}>Stripe Payments</h3>
                  <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>Card payments via Stripe</p>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '12px', background: '#DCFCE7', color: '#15803D', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' }}>✓ Configured</span>
              </div>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px' }}>Update your Stripe keys in Render environment variables to switch between test and live mode.</p>
              <div style={{ background: '#F3F4F6', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', fontFamily: 'monospace', color: '#374151' }}>
                STRIPE_SECRET_KEY=sk_live_... (set in Render dashboard)
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🏦</div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', margin: 0 }}>Bank Transfer</h3>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>Your platform bank account details shown to patients</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>{bankEnabled ? 'Enabled' : 'Disabled'}</span>
                  <button onClick={() => setBankEnabled(!bankEnabled)} style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', background: bankEnabled ? '#3CBEA0' : '#D1D5DB', cursor: 'pointer', position: 'relative' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: bankEnabled ? '21px' : '3px', transition: 'left 0.2s' }} />
                  </button>
                </div>
              </div>

              {bankSaved && <div style={{ padding: '10px 14px', background: '#DCFCE7', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', color: '#15803D' }}>✅ Saved successfully</div>}

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
{/* VERIFICATIONS */}
{activeTab === 'verifications' && (
  <VerificationsTab onVerify={(id: string) => handleVerifyUser(id, 'verify')} />
)}
      </div>
    </div>
  );
}

function VerificationsTab({ onVerify }: { onVerify: (id: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [docUrls, setDocUrls] = useState<Record<string, Record<string, string>>>({});
  const { data, isLoading: loading } = useQuery({
    queryKey: ['admin-verifications'],
    queryFn: () => api.get('/admin/verifications').then(r => r.data).catch(() => ({ doctors: [], drivers: [] })),
  });
  const loadDocs = async (userId: string) => {
    if (docUrls[userId]) { setExpandedId(expandedId === userId ? null : userId); return; }
    try {
      const res = await api.get('/admin/verifications/' + userId + '/docs');
      setDocUrls(prev => ({ ...prev, [userId]: res.data }));
      setExpandedId(userId);
    } catch { setExpandedId(expandedId === userId ? null : userId); }
  };
  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>Loading...</div>;
  const all = [...(data?.doctors || []), ...(data?.drivers || [])];
  return (
    <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Verification Requests</h2>
      <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>Pending doctor and driver accounts waiting for admin verification.</p>
      {all.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
          <p>No pending verifications.</p>
        </div>
      ) : all.map((u: any) => (
        <div key={u.id} style={{ border: '1px solid #E5E7EB', borderRadius: '12px', marginBottom: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px' }}>
            <div style={{ fontSize: '28px' }}>{u.role === 'doctor' ? '👨‍⚕️' : '🚗'}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#0B1F3A', margin: '0 0 2px' }}>{u.name}</p>
              <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 2px' }}>{u.email}</p>
              <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>
                {u.role === 'doctor' ? u.doctor?.specialization : u.driver?.vehicleInfo?.type || 'Driver'} • Registered {new Date(u.createdAt).toLocaleDateString('en-GB')}
              </p>
            </div>
            <button onClick={() => loadDocs(u.id)} style={{ padding: '6px 14px', background: '#EEF2FF', color: '#4338CA', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', marginRight: '8px' }}>
              {expandedId === u.id ? 'Hide Docs' : 'View Docs'}
            </button>
            <button onClick={() => onVerify(u.id)} style={{ padding: '8px 18px', background: '#3CBEA0', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              Verify
            </button>
          </div>
          {expandedId === u.id && (
            <div style={{ padding: '14px', borderTop: '1px solid #F3F4F6', background: '#F9FAFB' }}>
              {docUrls[u.id] && Object.keys(docUrls[u.id]).length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {Object.entries(docUrls[u.id]).map(([docType, url]: [string, any]) => (
                    <a key={docType} href={url} target='_blank' rel='noreferrer'
                      style={{ padding: '8px 16px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: '#0B1F3A', textDecoration: 'none' }}>
                      📄 {docType.replace(/_/g, ' ').toUpperCase()}
                    </a>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>No documents uploaded yet.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}