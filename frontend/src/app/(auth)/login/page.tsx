'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      const role = useAuthStore.getState().user?.role || 'patient';
      router.push('/' + role);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f9fc', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '16px', width: '100%', maxWidth: '400px', border: '1px solid #e2e8f0' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#0B1F3A', marginBottom: '8px' }}>VeraMed</h1>
        <p style={{ color: '#6B7280', marginBottom: '28px', fontSize: '14px' }}>Sign in to your account</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              placeholder="you@example.com" />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              placeholder="password" />
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
          <button type="submit" disabled={isLoading}
            style={{ width: '100%', padding: '12px', background: '#0B1F3A', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div style={{ marginTop: '24px', padding: '16px', background: '#f7f9fc', borderRadius: '10px', fontSize: '12px', color: '#6B7280' }}>
          <p style={{ fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Test accounts:</p>
          <p>patient@veramed.health / Patient@123!</p>
          <p>dr.patel@veramed.health / Doctor@123!</p>
          <p>boots@veramed.health / Pharmacy@123!</p>
          <p>driver@veramed.health / Driver@123!</p>
        </div>
      </div>
    </div>
  );
}
