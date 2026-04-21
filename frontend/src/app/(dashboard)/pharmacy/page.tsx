'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api-client';

export default function PharmacyDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'orders'|'inventory'|'wallet'|'withdraw'>('orders');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', genericName: '', strength: '', dosageForm: '', category: '', price: '', stock: '', description: '' });
  const [addingMed, setAddingMed] = useState(false);

  const { data: orders } = useQuery({
    queryKey: ['pharmacy-orders'],
    queryFn: () => api.get('/pharmacy/orders').then(r => r.data).catch(() => []),
    refetchInterval: 30000,
  });

  const { data: inventory, refetch: refetchInventory } = useQuery({
    queryKey: ['pharmacy-inventory'],
    queryFn: () => api.get('/pharmacy/inventory').then(r => r.data).catch(() => []),
  });

  const { data: wallet } = useQuery({
    queryKey: ['pharmacy-wallet'],
    queryFn: () => api.get('/pharmacy/wallet').then(r => r.data).catch(() => ({ balance: 0, transactions: [] })),
    refetchInterval: 60000,
  });

  const pendingOrders = orders?.filter((o: any) => ['confirmed','preparing'].includes(o.status)) || [];
  const completedOrders = orders?.filter((o: any) => ['delivered','completed'].includes(o.status)) || [];
  const walletBalance = wallet?.balance || 0;
  const walletTransactions = wallet?.transactions || [];

  const handleAddMedication = async () => {
    if (!newMed.name || !newMed.price || !newMed.stock) return;
    setAddingMed(true);
    try {
      await api.post('/pharmacy/medications', {
        name: newMed.name,
        genericName: newMed.genericName,
        strength: newMed.strength,
        dosageForm: newMed.dosageForm,
        category: newMed.category,
        price: Math.round(parseFloat(newMed.price) * 100),
        stock: parseInt(newMed.stock),
        description: newMed.description,
      });
      setNewMed({ name: '', genericName: '', strength: '', dosageForm: '', category: '', price: '', stock: '', description: '' });
      refetchInventory();
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.error || err.message));
    } finally { setAddingMed(false); }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !bankName || !accountNumber || !accountName) {
      alert('Please fill in all bank details');
      return;
    }
    if (parseFloat(withdrawAmount) > walletBalance / 100) {
      alert('Insufficient wallet balance');
      return;
    }
    setWithdrawLoading(true);
    try {
      await api.post('/pharmacy/withdraw', {
        amount: Math.round(parseFloat(withdrawAmount) * 100),
        bankDetails: { bankName, accountNumber, sortCode, accountName },
      });
      setWithdrawSuccess(true);
      setWithdrawAmount('');
      setBankName('');
      setAccountNumber('');
      setSortCode('');
      setAccountName('');
      queryClient.invalidateQueries({ queryKey: ['pharmacy-wallet'] });
    } catch (err: any) {
      alert('Error: ' + (err?.response?.data?.error || err.message));
    } finally { setWithdrawLoading(false); }
  };

  const firstName = user?.name?.split(' ')[0] || 'Pharmacy';

  const tabStyle = (t: string) => ({
    padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
    background: activeTab === t ? '#0B1F3A' : 'white',
    color: activeTab === t ? 'white' : '#6B7280',
    boxShadow: activeTab === t ? '0 2px 8px rgba(11,31,58,0.2)' : 'none',
    transition: 'all 0.15s',
  } as React.CSSProperties);

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); *{font-family:"DM Sans",sans-serif;box-sizing:border-box;}`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '32px 40px 64px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(60,190,160,0.08)' }} />
        <p style={{ color: '#3CBEA0', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Pharmacy Portal</p>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 6px' }}>{firstName}</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>Manage your orders, inventory and earnings</p>
      </div>

      <div style={{ maxWidth: '1000px', margin: '-36px auto 0', padding: '0 24px 48px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Pending Orders', value: pendingOrders.length, icon: '📦', bg: '#FEF3C7', accent: '#D97706' },
            { label: 'Completed', value: completedOrders.length, icon: '✅', bg: '#DCFCE7', accent: '#16A34A' },
            { label: 'Wallet Balance', value: `£${(walletBalance / 100).toFixed(2)}`, icon: '💰', bg: '#EEF2FF', accent: '#4F46E5' },
            { label: 'Medications', value: inventory?.length || 0, icon: '💊', bg: '#F0F9FF', accent: '#0284C7' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '12px' }}>{s.icon}</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#0B1F3A', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px', fontWeight: '500' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#E5E7EB', padding: '4px', borderRadius: '14px', width: 'fit-content' }}>
          {[{k:'orders',l:'📦 Orders'},{k:'inventory',l:'💊 Inventory'},{k:'wallet',l:'💰 Wallet'},{k:'withdraw',l:'🏦 Withdraw'}].map(t => (
            <button key={t.k} style={tabStyle(t.k)} onClick={() => setActiveTab(t.k as any)}>{t.l}</button>
          ))}
        </div>

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '20px' }}>Active Orders</h2>
            {pendingOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <p style={{ color: '#6B7280', fontSize: '14px' }}>No active orders right now. Orders appear here when patients select your pharmacy after doctor approval.</p>
              </div>
            ) : (
              pendingOrders.map((o: any) => (
                <div key={o.id} style={{ border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: '#0B1F3A', margin: '0 0 2px' }}>Order #{o.id?.slice(-8).toUpperCase()}</p>
                      <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>Patient: {o.patient?.user?.name || 'Patient'}</p>
                    </div>
                    <span style={{ fontSize: '12px', background: '#FEF3C7', color: '#D97706', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' }}>
                      {o.status === 'confirmed' ? '⏳ Prepare' : '📦 Ready'}
                    </span>
                  </div>
                  {o.items?.map((item: any, i: number) => (
                    <div key={i} style={{ fontSize: '13px', color: '#374151', padding: '6px 10px', background: '#F9FAFB', borderRadius: '8px', marginBottom: '4px' }}>
                      💊 {item.medication?.name || 'Medication'} × {item.quantity} — £{((item.unitPrice * item.quantity) / 100).toFixed(2)}
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#0B1F3A', margin: 0 }}>Total: £{(o.totalPrice / 100).toFixed(2)}</p>
                    <button onClick={() => api.post(`/pharmacy/orders/${o.id}/ready`).then(() => queryClient.invalidateQueries({queryKey:['pharmacy-orders']}))}
                      style={{ padding: '8px 16px', background: '#3CBEA0', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                      Mark Ready for Pickup
                    </button>
                  </div>
                </div>
              ))
            )}

            {completedOrders.length > 0 && (
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #F3F4F6' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>Completed Orders</h3>
                {completedOrders.slice(0,5).map((o: any) => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F9FAFB', borderRadius: '10px', marginBottom: '6px' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: '#374151', margin: '0 0 2px' }}>#{o.id?.slice(-8).toUpperCase()} — {o.patient?.user?.name}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{new Date(o.updatedAt || o.createdAt).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '14px', fontWeight: '700', color: '#16A34A', margin: '0 0 2px' }}>+£{(o.totalPrice / 100).toFixed(2)}</p>
                      <span style={{ fontSize: '11px', background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '10px' }}>✓ Paid to wallet</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Add medication */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>Add Medication</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Medication Name *</label>
                  <input value={newMed.name} onChange={e => setNewMed({...newMed, name: e.target.value})} placeholder="e.g. Metformin 500mg"
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Generic Name (INN)</label>
                  <input value={newMed.genericName} onChange={e => setNewMed({...newMed, genericName: e.target.value})} placeholder="e.g. Paracetamol, Ibuprofen"
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none', marginBottom: '12px' }} />
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Strength</label>
                  <input value={newMed.strength} onChange={e => setNewMed({...newMed, strength: e.target.value})} placeholder="e.g. 500mg, 10mg/5ml"
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none', marginBottom: '12px' }} />
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Dose Form</label>
                  <select value={newMed.dosageForm} onChange={e => setNewMed({...newMed, dosageForm: e.target.value})}
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none', background: 'white', marginBottom: '12px' }}>
                    <option value="">Select form</option>
                    <option value="tablet">Tablet</option>
                    <option value="capsule">Capsule</option>
                    <option value="syrup">Syrup</option>
                    <option value="injection">Injection</option>
                    <option value="cream">Cream/Ointment</option>
                    <option value="drops">Drops</option>
                    <option value="inhaler">Inhaler</option>
                    <option value="other">Other</option>
                  </select>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Category</label>
                  <select value={newMed.category} onChange={e => setNewMed({...newMed, category: e.target.value})}
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none', background: 'white', marginBottom: '12px' }}>
                    <option value="">Select category</option>
                    <option value="antibiotic">Antibiotic</option>
                    <option value="analgesic">Analgesic / Painkiller</option>
                    <option value="antihistamine">Antihistamine</option>
                    <option value="antiviral">Antiviral</option>
                    <option value="cardiovascular">Cardiovascular</option>
                    <option value="diabetes">Diabetes</option>
                    <option value="respiratory">Respiratory</option>
                    <option value="vitamin">Vitamin / Supplement</option>
                    <option value="other">Other</option>
                  </select>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Price (£) *</label>
                  <input value={newMed.price} onChange={e => setNewMed({...newMed, price: e.target.value})} placeholder="e.g. 12.99" type="number" step="0.01"
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Stock Quantity *</label>
                  <input value={newMed.stock} onChange={e => setNewMed({...newMed, stock: e.target.value})} placeholder="e.g. 100" type="number"
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Description</label>
                  <input value={newMed.description} onChange={e => setNewMed({...newMed, description: e.target.value})} placeholder="Optional notes"
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                </div>
              </div>
              <button onClick={handleAddMedication} disabled={addingMed || !newMed.name || !newMed.price || !newMed.stock}
                style={{ padding: '11px 24px', background: (!newMed.name || !newMed.price || !newMed.stock) ? '#9CA3AF' : '#0B1F3A', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                {addingMed ? 'Adding...' : '+ Add to Inventory'}
              </button>
            </div>

            {/* Inventory list */}
            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>Current Inventory ({inventory?.length || 0})</h2>
              {!inventory || inventory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#6B7280', fontSize: '14px' }}>No medications added yet. Add your first medication above.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {inventory.map((med: any) => (
                    <div key={med.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', border: '1px solid #F3F4F6', borderRadius: '12px', background: '#FAFAFA' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>💊</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 1px' }}>{med.name}</p>
                        {med.genericName && <p style={{ fontSize: '11px', color: '#3B82F6', margin: '0 0 2px', fontStyle: 'italic' }}>Generic: {med.genericName} {med.strength || ''}</p>}
                        <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>Stock: {med.stock} units {med.dosageForm ? '· ' + med.dosageForm : ''}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 2px' }}>£{(med.price / 100).toFixed(2)}</p>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: '500', background: med.stock > 10 ? '#DCFCE7' : '#FEE2E2', color: med.stock > 10 ? '#15803D' : '#DC2626' }}>
                          {med.stock > 10 ? 'In Stock' : med.stock === 0 ? 'Out of Stock' : 'Low Stock'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* WALLET TAB */}
        {activeTab === 'wallet' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'linear-gradient(135deg, #0B1F3A, #1a3a5c)', borderRadius: '20px', padding: '28px', color: 'white' }}>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Available Balance</p>
              <p style={{ fontSize: '40px', fontWeight: '700', margin: '0 0 8px' }}>£{(walletBalance / 100).toFixed(2)}</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Earnings from completed deliveries • Auto-updated on delivery confirmation</p>
              <button onClick={() => setActiveTab('withdraw')} style={{ marginTop: '16px', padding: '10px 20px', background: '#3CBEA0', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                Withdraw Funds →
              </button>
            </div>

            <div style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '16px' }}>Transaction History</h2>
              {walletTransactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#6B7280', fontSize: '14px' }}>No transactions yet. Earnings appear here after each delivery is completed.</div>
              ) : (
                walletTransactions.map((t: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: '#374151', margin: '0 0 2px' }}>{t.description || 'Delivery payment'}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{new Date(t.createdAt).toLocaleDateString('en-GB')}</p>
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: t.type === 'credit' ? '#16A34A' : '#DC2626', margin: 0 }}>
                      {t.type === 'credit' ? '+' : '-'}£{(t.amount / 100).toFixed(2)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* WITHDRAW TAB */}
        {activeTab === 'withdraw' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0B1F3A', marginBottom: '6px' }}>Request Withdrawal</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>Enter your bank details and withdrawal amount. An admin will process within 2-3 business days.</p>

            {withdrawSuccess && (
              <div style={{ padding: '16px', background: '#DCFCE7', borderRadius: '12px', border: '1px solid #BBF7D0', marginBottom: '20px', fontSize: '14px', color: '#15803D', fontWeight: '500' }}>
                ✅ Withdrawal request submitted! Admin will process within 2-3 business days.
              </div>
            )}

            <div style={{ padding: '16px', background: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE', marginBottom: '24px', fontSize: '13px', color: '#1D4ED8' }}>
              💰 Available balance: <strong>£{(walletBalance / 100).toFixed(2)}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Withdrawal Amount (£) *</label>
                <input value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="e.g. 50.00" type="number" step="0.01" max={walletBalance / 100}
                  style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
              </div>
              <div style={{ height: '1px', background: '#F3F4F6' }} />
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#374151', margin: 0 }}>Bank Details</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Account Name *</label>
                  <input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Full name on account"
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Bank Name *</label>
                  <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Barclays"
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Account Number *</label>
                  <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="8 digits"
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Sort Code</label>
                  <input value={sortCode} onChange={e => setSortCode(e.target.value)} placeholder="e.g. 20-00-00"
                    style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: '#FFFBEB', borderRadius: '10px', border: '1px solid #FCD34D', fontSize: '12px', color: '#92400E' }}>
                ⚠️ Admin will manually verify and process your withdrawal. Your wallet balance will be updated once processed.
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
