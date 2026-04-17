'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';

const NAV_CONFIG: Record<string, Array<{label: string; href: string}>> = {
  patient:  [{ label: 'Dashboard', href: '/patient' }, { label: 'Upload Report', href: '/patient/upload' }, { label: 'My Reports', href: '/patient/reports' }, { label: 'Prescriptions', href: '/patient/prescriptions' }, { label: 'My Orders', href: '/patient/orders' },
    { label: 'Settings', href: '/patient/settings' }],
  doctor:   [{ label: 'Dashboard', href: '/doctor' }, { label: 'Pending Cases', href: '/doctor/cases' }, { label: 'History', href: '/doctor/history' }, { label: 'Upload Documents', href: '/doctor/verification' }],
  pharmacy: [{ label: 'Overview', href: '/pharmacy' }, { label: 'Inventory', href: '/pharmacy/inventory' }, { label: 'Orders', href: '/pharmacy/orders' }],
  driver:   [{ label: 'Dashboard', href: '/driver' }, { label: 'Deliveries', href: '/driver/deliveries' }],
  admin:    [{ label: 'Dashboard', href: '/admin' }, { label: 'Users', href: '/admin/users' },
    { label: 'Country Pricing', href: '/admin/pricing' }],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    if (!useAuthStore.getState().user) {
      router.replace('/login');
    }
  }, [router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!ready || !user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#6B7280', fontFamily: 'sans-serif' }}>Loading...</p>
    </div>
  );

  const navItems = NAV_CONFIG[user.role] || [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <aside style={{ width: '240px', background: '#0B1F3A', color: 'white', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>VeraMed</div>
          <div style={{ fontSize: '12px', color: '#3CBEA0', textTransform: 'capitalize' }}>{user.role} Portal</div>
        </div>
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              style={{ display: 'block', padding: '10px 12px', borderRadius: '8px', marginBottom: '4px', fontSize: '14px', fontWeight: '500', textDecoration: 'none',
                background: pathname === item.href ? 'rgba(60,190,160,0.2)' : 'transparent',
                color: pathname === item.href ? '#3CBEA0' : 'rgba(255,255,255,0.65)' }}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: 'white', marginBottom: '2px' }}>{user.name}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>{user.email}</div>
          <button onClick={handleLogout}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Sign out
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, background: '#f7f9fc', overflow: 'auto' }}>
        <div style={{ padding: '0' }}>{children}</div>
      </main>
    </div>
  );
}
