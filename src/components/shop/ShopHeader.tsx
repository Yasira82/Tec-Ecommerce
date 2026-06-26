'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Icon } from '@yasser172/tec-ui';

interface Props {
  piReady:      boolean;
  onMenuOpen:   () => void;
  cartCount?:   number;
  onCartOpen?:  () => void;
}

export function ShopHeader({ piReady, onMenuOpen, cartCount = 0, onCartOpen }: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const navStyle = (path: string): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontFamily: 'system-ui', fontSize: 12, fontWeight: 600,
    background: isActive(path) ? 'rgba(251,191,36,0.12)' : 'transparent',
    color:      isActive(path) ? '#FBBF24' : '#6b6b7a',
  });

  return (
    <header style={{ position:'sticky', top:0, zIndex:100, background:'rgba(7,7,15,0.85)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(251,191,36,0.12)' }}>
      <div style={{ maxWidth:800, margin:'0 auto', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>

        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <button onClick={onMenuOpen} style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, padding:0 }}>
            {[0,1,2].map(i => <span key={i} style={{ width:14, height:1.5, background:'#888', borderRadius:2, display:'block' }} />)}
          </button>
          <button onClick={() => router.push('/shop')} style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#FBBF24,#F59E0B)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#050816', fontSize:16 }}>T</div>
            <span style={{ fontSize:15, fontWeight:700, color:'#e8d5a3', letterSpacing:'0.04em', fontFamily:'Georgia,serif' }}>TEC Store</span>
          </button>
        </div>

        <nav style={{ display:'flex', gap:2, alignItems:'center', flex:1, justifyContent:'center' }}>
          <button onClick={() => router.push('/shop')}     style={navStyle('/shop')}><span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><Icon name="store" size={15} />Shop</span></button>
          <button onClick={() => router.push('/orders')}   style={navStyle('/orders')}><span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><Icon name="receipt" size={15} />Orders</span></button>
          <button onClick={() => router.push('/merchant')} style={navStyle('/merchant')}><span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><Icon name="tag" size={15} />Sell</span></button>
        </nav>

        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {onCartOpen && (
            <button
              onClick={onCartOpen}
              style={{
                position:'relative', display:'flex', alignItems:'center', gap:5,
                padding: cartCount > 0 ? '7px 14px' : '7px 12px',
                borderRadius:20, cursor:'pointer', fontFamily:'system-ui', fontSize:13, fontWeight:700,
                background: cartCount > 0 ? 'linear-gradient(135deg,rgba(251,191,36,0.22),rgba(251,191,36,0.12))' : 'rgba(255,255,255,0.06)',
                border: cartCount > 0 ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.1)',
                color: cartCount > 0 ? '#FBBF24' : '#888',
                transition: 'all 0.2s',
              }}
            >
              <Icon name="cart" size={18} />
              {cartCount > 0 && (
                <span style={{ fontFamily:'system-ui', fontSize:12, fontWeight:900, color:'#FBBF24', lineHeight:1 }}>
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>
          )}
          <span style={{ fontFamily:'system-ui', fontSize:11, padding:'4px 10px', borderRadius:20, background: piReady ? 'rgba(126,231,192,0.1)' : 'rgba(255,255,255,0.06)', color: piReady ? '#7ee7c0' : '#666', border: piReady ? '1px solid rgba(126,231,192,0.2)' : '1px solid rgba(255,255,255,0.08)' }}>
            {piReady ? 'π ✓' : '···'}
          </span>
        </div>

      </div>
    </header>
  );
}
