'use client';

interface Props { piReady: boolean; onMenuOpen: () => void }

export function ShopHeader({ piReady, onMenuOpen }: Props) {
  return (
    <header style={{ position:'sticky', top:0, zIndex:100, background:'rgba(7,7,15,0.85)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(212,175,55,0.12)' }}>
      <div style={{ maxWidth:800, margin:'0 auto', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* ✅ Hamburger */}
          <button onClick={onMenuOpen} style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, padding:0 }}>
            {[0,1,2].map(i => <span key={i} style={{ width:14, height:1.5, background:'#888', borderRadius:2, display:'block' }} />)}
          </button>
          <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#d4af37,#8b6914)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#07070f' }}>T</div>
          <span style={{ fontSize:16, fontWeight:700, color:'#e8d5a3', letterSpacing:'0.04em' }}>TEC Store</span>
        </div>
        <span style={{ fontFamily:'system-ui,sans-serif', fontSize:11, padding:'4px 10px', borderRadius:20, background: piReady ? 'rgba(126,231,192,0.1)' : 'rgba(255,255,255,0.06)', color: piReady ? '#7ee7c0' : '#666', border: piReady ? '1px solid rgba(126,231,192,0.2)' : '1px solid rgba(255,255,255,0.08)' }}>
          {piReady ? 'Pi Ready ✓' : 'Connecting...'}
        </span>
      </div>
    </header>
  );
}
