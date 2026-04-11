export default function BlockedPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', fontFamily: 'system-ui', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '480px' }}>
        <div style={{ fontSize: '72px', marginBottom: '24px' }}>🌏</div>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0F172A', marginBottom: '12px' }}>Not Available Yet</h1>
        <p style={{ fontSize: '16px', color: '#64748B', marginBottom: '8px', lineHeight: 1.6 }}>VeraMed is currently available in Bangladesh, Pakistan, India, Sri Lanka, Nepal, Bhutan, Maldives and Afghanistan.</p>
        <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '32px' }}>We are expanding to more countries soon. Please check back later.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '32px' }}>
          {['🇧🇩 Bangladesh','🇵🇰 Pakistan','🇮🇳 India','🇱🇰 Sri Lanka','🇳🇵 Nepal','🇧🇹 Bhutan','🇲🇻 Maldives','🇦🇫 Afghanistan'].map(c => (
            <span key={c} style={{ padding: '6px 14px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', fontSize: '13px', color: '#374151' }}>{c}</span>
          ))}
        </div>
        <p style={{ fontSize: '13px', color: '#94A3B8' }}>Questions? Contact us at support@veramed.health</p>
      </div>
    </div>
  );
}