'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api-client';

export default function PatientWalletPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'balance'|'topup'|'bank'>('balance');
  const [topupAmount, setTopupAmount] = useState('');
  const [topupMethod, setTopupMethod] = useState<'stripe'|'bank'>('stripe');
  const [transferRef, setTransferRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const { data: wallet } = useQuery({
    queryKey: ['patient-wallet'],
    queryFn: () => api.get('/patient/wallet').then(r => r.data).catch(() => ({ balance: 0, transactions: [] })),
    refetchInterval: 30000,
  });

  const { data: paymentMethods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api.get('/admin/payment-methods').then(r => r.data).catch(() => ({ stripe: true, bankTransfer: { enabled: false, bankName: '', accountNumber: '', sortCode: '', accountName: '', reference: '' } })),
  });

  const balance = wallet?.balance || 0;
  const transactions = wallet?.transactions || [];
  const bankDetails = paymentMethods?.bankTransfer;

  const handleStripeTopup = async () => {
    if (!topupAmount || parseFloat(topupAmount) < 1) { alert('Minimum top-up is £1'); return; }
    setLoading(true);
    try {
      const res = await api.post('/patient/wallet/topup-stripe', { amount: Math.round(parseFloat(topupAmount) * 100) });
      if (res.data?.url) window.location.href = res.data.url;
      else { setSuccess('Payment initiated'); queryClient.invalidateQueries({ queryKey: ['patient-wallet'] }); }
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.error || err.message));
    } finally { setLoading(false); }
  };

  const handleBankTopupRequest = async () => {
    if (!topupAmount || !transferRef) { alert('Please enter amount and transfer reference'); return; }
    setLoading(true);
    try {
      await api.post('/patient/wallet/topup-bank', {
        amount: Math.round(parseFloat(topupAmount) * 100),
        transferReference: transferRef,
      });
      setSuccess('Your top-up request has been submitted. Admin will verify and add to your wallet within 24 hours.');
      setTopupAmount('');
      setTransferRef('');
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.error || err.message));
    } finally { setLoading(false); }
  };

  const tabStyle = (t: string) => ({
    padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
    background: activeTab === t ? '#0B1F3A' : 'white',
    color: activeTab === t ? 'white' : '#6B7280',
    transition: 'all 0.15s',
  } as React.CSSProperties);

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); *{font-family:"DM Sans",sans-serif;box-sizing:border-box;}`}</style>

      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '36px 40px 60px' }}>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 6px' }}>My Wallet</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: 0 }}>Add funds and pay for medications securely</p>
      </div>

      <div style={{ maxWidth: '700px', margin: '-30px auto 0', padding: '0 24px 48px' }}>

        {/* Balance card */}
        <div style={{ background: 'linear-gradient(135deg, #0B1F3A, #1a3a5c)', borderRadius: '20px', padding: '28px', color: 'white', marginBottom: '20px', boxShadow: '0 8px 32px rgba(11,31,58,0.25)' }}>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Wallet Balance</p>
          <p style={{ fontSize: '44px', fontWeight: '700', margin: '0 0 4px' }}>£{(balance / 100).toFixed(2)}</p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: '0 0 20px' }}>Available to spend on medications</p>
          <button onClick={() => setActiveTab('topup')} style={{ padding: '10px 20px', background: '#3CBEA0', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            + Add Funds
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#E5E7EB', padding: '4px', borderRadius: '14px', width: 'fit-content' }}>
          {[{k:'balance',l:'📊 Transactions'},{k:'topup',l:'💳 Add Funds'},{k:'bank',l:'🏦 Bank Transfer'}].map(t => (
            <button key={t.k} style={tabStyle(t.k)} onClick={() => setActiveTab(t.k as any)}>{t.l}</button>
          ))}
        </div>

        {/* TRANSACTIONS */}
        {activeTab === 'balance' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>Transaction History</h2>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>💳</div>
                <p style={{ color: '#6B7280', fontSize: '14px' }}>No transactions yet. Add funds to get started.</p>
              </div>
            ) : transactions.map((t: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: t.type === 'credit' ? '#DCFCE7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                    {t.type === 'credit' ? '↓' : '↑'}
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '500', color: '#374151', margin: '0 0 2px' }}>{t.description || (t.type === 'credit' ? 'Funds added' : 'Payment')}</p>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: t.type === 'credit' ? '#16A34A' : '#DC2626', margin: '0 0 2px' }}>
                    {t.type === 'credit' ? '+' : '-'}£{(t.amount / 100).toFixed(2)}
                  </p>
                  <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '6px', background: t.status === 'completed' ? '#F0FDF4' : '#FEF3C7', color: t.status === 'completed' ? '#15803D' : '#D97706' }}>
                    {t.status === 'pending' ? '⏳ Pending' : '✓ Done'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ADD FUNDS */}
        {activeTab === 'topup' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Add Funds to Wallet</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>Choose your payment method</p>

            {success && (
              <div style={{ padding: '14px', background: '#DCFCE7', borderRadius: '12px', border: '1px solid #BBF7D0', marginBottom: '20px', fontSize: '13px', color: '#15803D' }}>✅ {success}</div>
            )}

            {/* Method selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <button onClick={() => setTopupMethod('stripe')} style={{ padding: '16px', border: `2px solid ${topupMethod === 'stripe' ? '#0B1F3A' : '#E5E7EB'}`, borderRadius: '14px', background: topupMethod === 'stripe' ? '#F9FAFB' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>💳</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#0B1F3A' }}>Card / Stripe</div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>Instant • Visa, Mastercard</div>
              </button>
              <button onClick={() => setTopupMethod('bank')} style={{ padding: '16px', border: `2px solid ${topupMethod === 'bank' ? '#0B1F3A' : '#E5E7EB'}`, borderRadius: '14px', background: topupMethod === 'bank' ? '#F9FAFB' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>🏦</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#0B1F3A' }}>Bank Transfer</div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>1-24hrs • Free</div>
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Amount (£) *</label>
              <input value={topupAmount} onChange={e => setTopupAmount(e.target.value)} placeholder="e.g. 50.00" type="number" step="0.01" min="1"
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '12px', fontSize: '14px', outline: 'none' }} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {[10,25,50,100].map(a => (
                  <button key={a} onClick={() => setTopupAmount(a.toString())} style={{ padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: '8px', background: topupAmount === a.toString() ? '#0B1F3A' : 'white', color: topupAmount === a.toString() ? 'white' : '#374151', fontSize: '13px', cursor: 'pointer' }}>£{a}</button>
                ))}
              </div>
            </div>

            {topupMethod === 'stripe' ? (
              <button onClick={handleStripeTopup} disabled={loading}
                style={{ width: '100%', padding: '13px', background: loading ? '#9CA3AF' : '#635BFF', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? '⏳ Processing...' : '💳 Pay with Stripe'}
              </button>
            ) : (
              <button onClick={() => setActiveTab('bank')}
                style={{ width: '100%', padding: '13px', background: '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                🏦 View Bank Transfer Details →
              </button>
            )}
          </div>
        )}

        {/* BANK TRANSFER */}
        {activeTab === 'bank' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Bank Transfer Details</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>Transfer to the account below, then submit your reference number to request wallet update.</p>

              {!bankDetails?.enabled ? (
                <div style={{ padding: '16px', background: '#FEF3C7', borderRadius: '12px', border: '1px solid #FCD34D', fontSize: '13px', color: '#92400E' }}>
                  ⚠️ Bank transfer is not currently enabled. Please use Stripe or contact support.
                </div>
              ) : (
                <>
                  <div style={{ background: '#F9FAFB', borderRadius: '14px', padding: '20px', border: '1px solid #E5E7EB', marginBottom: '20px' }}>
                    {[
                      { label: 'Bank Name', value: bankDetails.bankName },
                      { label: 'Account Name', value: bankDetails.accountName },
                      { label: 'Account Number', value: bankDetails.accountNumber },
                      { label: 'Sort Code', value: bankDetails.sortCode },
                      { label: 'Reference', value: bankDetails.reference || 'VERAMED-' + Date.now().toString().slice(-6) },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ fontSize: '13px', color: '#6B7280' }}>{row.label}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#0B1F3A' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '12px 14px', background: '#EFF6FF', borderRadius: '10px', border: '1px solid #BFDBFE', fontSize: '12px', color: '#1D4ED8', marginBottom: '20px' }}>
                    💡 Use your email as the payment reference so we can identify your transfer.
                  </div>
                </>
              )}
            </div>

            {bankDetails?.enabled && (
              <div style={{ background: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>Request Wallet Top-Up</h3>
                <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>Already transferred? Submit the details below and admin will verify and credit your wallet.</p>

                {success && <div style={{ padding: '12px', background: '#DCFCE7', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', color: '#15803D' }}>✅ {success}</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Amount Transferred (£) *</label>
                    <input value={topupAmount} onChange={e => setTopupAmount(e.target.value)} placeholder="e.g. 50.00" type="number"
                      style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Transfer Reference / Receipt Number *</label>
                    <input value={transferRef} onChange={e => setTransferRef(e.target.value)} placeholder="e.g. your email or bank reference"
                      style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                  </div>
                  <button onClick={handleBankTopupRequest} disabled={loading}
                    style={{ padding: '12px', background: loading ? '#9CA3AF' : '#0B1F3A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>
                    {loading ? '⏳ Submitting...' : '📨 Submit Top-Up Request'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
