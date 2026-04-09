'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

const STEPS = ['Order Placed', 'Pharmacy Preparing', 'Driver Assigned', 'Out for Delivery', 'Delivered'];

const statusToStep: Record<string, number> = {
  pending: 0, confirmed: 1, preparing: 1, ready_for_pickup: 2,
  assigned: 2, picked_up: 3, out_for_delivery: 3, delivered: 4, completed: 4,
};

export default function OrdersPage() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/patient/orders').then(r => r.data).catch(() => []),
  });

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 100%)', padding: '36px 40px 60px' }}>
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 6px' }}>My Orders</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: 0 }}>Track your medication deliveries in real time</p>
      </div>

      <div style={{ maxWidth: '800px', margin: '-30px auto 0', padding: '0 24px 48px' }}>
        {isLoading ? (
          <div style={{ background: 'white', borderRadius: '20px', padding: '60px', textAlign: 'center', color: '#6B7280', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>Loading orders...</div>
        ) : !orders || orders.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '20px', padding: '60px 24px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚚</div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0B1F3A', marginBottom: '8px' }}>No orders yet</h3>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>Once you order medications from an approved prescription, your orders will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {orders.map((order: any) => {
              const step = statusToStep[order.status] ?? 0;
              const isDelivered = step === 4;
              return (
                <div key={order.id} style={{ background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '0 0 4px' }}>Order #{order.id.slice(-8).toUpperCase()}</p>
                      <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>{new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '18px', fontWeight: '700', color: '#0B1F3A', margin: '0 0 2px' }}>£{(order.totalPrice / 100).toFixed(2)}</p>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', background: isDelivered ? '#DCFCE7' : '#DBEAFE', color: isDelivered ? '#15803D' : '#1D4ED8' }}>
                        {isDelivered ? '✓ Delivered' : '🚚 In Progress'}
                      </span>
                    </div>
                  </div>

                  {/* Progress tracker */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                      {STEPS.map((label, i) => {
                        const done = step > i; const active = step === i;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 4 ? 1 : 'none' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', background: done ? '#3CBEA0' : active ? '#0B1F3A' : '#E5E7EB', color: done || active ? 'white' : '#9CA3AF', flexShrink: 0 }}>
                                {done ? '✓' : i + 1}
                              </div>
                              <span style={{ fontSize: '10px', fontWeight: active || done ? '600' : '400', color: active ? '#0B1F3A' : done ? '#3CBEA0' : '#9CA3AF', textAlign: 'center', width: '60px', lineHeight: 1.3 }}>{label}</span>
                            </div>
                            {i < 4 && <div style={{ flex: 1, height: '2px', background: done ? '#3CBEA0' : '#E5E7EB', margin: '0 4px', marginBottom: '20px' }} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Order items */}
                  {order.items?.length > 0 && (
                    <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '16px' }}>
                      <p style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {order.items.map((item: any, i: number) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 12px', background: '#F9FAFB', borderRadius: '8px' }}>
                            <span style={{ color: '#374151' }}>💊 {item.medication?.name || 'Medication'} × {item.quantity}</span>
                            <span style={{ color: '#6B7280', fontWeight: '500' }}>£{((item.unitPrice * item.quantity) / 100).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {order.delivery && (
                    <div style={{ marginTop: '14px', padding: '12px 16px', background: '#F0FDF4', borderRadius: '10px', border: '1px solid #BBF7D0', fontSize: '13px', color: '#15803D' }}>
                      🚗 Driver: {order.delivery.driver?.user?.name || 'Assigned'} • {order.delivery.status?.replace(/_/g, ' ')}
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
