'use client';

export function ShopHero({ username }: { username?: string | null }) {
  return (
    <section style={{
      padding: '20px 16px 16px',
      borderBottom: '1px solid rgba(251,191,36,0.06)',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {username && (
            <span style={{ fontSize: 11, color: '#FBBF24', fontWeight: 700 }}>@{username}</span>
          )}
          <span style={{
            fontSize: 9, color: '#FBBF24', letterSpacing: 0.5,
            padding: '2px 8px', borderRadius: 10,
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)',
          }}>π Mainnet</span>
        </div>
        <h1 style={{
          fontSize: 22, fontWeight: 900, color: '#e8d5a3',
          letterSpacing: '-0.02em', marginBottom: 2, fontFamily: 'Georgia,serif',
        }}>TEC Store</h1>
        <p style={{ fontSize: 12, color: '#4a4a5a' }}>Shop with Pi — instant payments</p>
      </div>
    </section>
  );
}
