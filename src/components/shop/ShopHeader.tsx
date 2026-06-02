'use client';

import { useRouter, usePathname } from 'next/navigation';

interface Props { piReady: boolean; onMenuOpen: () => void }

export function ShopHeader({ piReady, onMenuOpen }: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const navStyle = (path: string): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontFamily: 'system-ui', fontSize: 12, fontWeight: 600,
    background: isActive(path) ? 'rgba(212,175,55,0.12)' : 'transparent',
    color:      isActive(path) ? '#d4af37' : '#6b6b7a',
  });

  return (
    <header style={{ position:'sticky', top:0, zIndex:100, background:'rgba(7,7,15,0.85)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(212,175,55,0.12)' }}>
      <div style={{ maxWidth:800, margin:'0 auto', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>

        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={onMenuOpen} style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, padding:0 }}>
            {[0,1,2].map(i => <span key={i} style={{ width:14, height:1.5, background:'#888', borderRadius:2, display:'block' }} />)}
          </button>
          <button onClick={() => router.push('/shop')} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#d4af37,#8b6914)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#07070f', fontSize:16 }}>T</div>
            <span style={{ fontSize:15, fontWeight:700, color:'#e8d5a3', letterSpacing:'0.04em', fontFamily:'Georgia,serif' }}>TEC Store</span>
          </button>
        </div>

        <nav style={{ display:'flex', gap:2 }}>
          <button onClick={() => router.push('/shop')}   style={navStyle('/shop')}>🛍 Shop</button>
          <button onClick={() => router.push('/orders')} style={navStyle('/orders')}>🧾 Orders</button>
        </nav>

        <span style={{ fontFamily:'system-ui', fontSize:11, padding:'4px 10px', borderRadius:20, flexShrink:0, background: piReady ? 'rgba(126,231,192,0.1)' : 'rgba(255,255,255,0.06)', color: piReady ? '#7ee7c0' : '#666', border: piReady ? '1px solid rgba(126,231,192,0.2)' : '1px solid rgba(255,255,255,0.08)' }}>
          {piReady ? 'π ✓' : '···'}
        </span>

      </div>
    </header>
  );
}
