'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams }              from 'next/navigation';
import { TEC_COLORS }                        from '@yasser172/tec-ui';
import { getStoredUser, getAccessToken }     from '@/lib-client/pi/pi-auth';
import { useCart }                           from '@/lib-client/cart/useCart';
import { CartDrawer }                        from '@/components/shop/CartDrawer';

interface Product {
  id: string; title: string; price: number;
  images?: string[]; image_url?: string;
}
interface Merchant {
  display_name?: string; username?: string;
  joined_at?: string; products_count?: number;
  sales_count?: number; rating?: number;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';
const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';

const isHubNavigation = () =>
  typeof document !== 'undefined' &&
  document.referrer.toLowerCase().includes('hub.tecosystem.app');

const buyRedirect = (product: Product) => {
  window.location.href = `${HUB_URL}/hub?pay=1`
    + `&amount=${product.price}`
    + `&memo=${encodeURIComponent(`Buy ${product.title} — TEC Ecommerce`)}`
    + `&product_id=${encodeURIComponent(product.id)}`
    + `&return_url=${encodeURIComponent(`${APP_URL}/shop`)}`
    + `&source=ecommerce`;
};

const formatPi = (amount: number) => `${Number(amount).toFixed(2)}π`;
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

function StoreProductCard({ product, onBuy, onAddToCart, onCartOpen }: { product: Product; onBuy: (p: Product) => void; onAddToCart: (p: Product) => void; onCartOpen?: () => void; }) {
  const [imgError, setImgError] = useState(false);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    onAddToCart(product);
    onCartOpen?.();
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  return (
    <div style={{ background:'#0d0d14', border:'1px solid #ffffff08', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column' }}>
      <div style={{ width:'100%', aspectRatio:'1', background:'#ffffff05', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {product.images?.[0] && !imgError ? (
          <img src={product.images[0]} alt={product.title} onError={() => setImgError(true)}
            style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <span style={{ fontSize:32 }}>🛍️</span>
        )}
      </div>
      <div style={{ padding:'10px 12px', flex:1, display:'flex', flexDirection:'column', gap:4 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {product.title}
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto', paddingTop:6 }}>
          <span style={{ fontSize:14, fontWeight:900, color:TEC_COLORS.gold }}>{formatPi(product.price)}</span>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={handleAdd}
              style={{ padding:'5px 10px', background: added ? 'rgba(16,185,129,0.12)' : 'rgba(212,175,55,0.08)', border: added ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(212,175,55,0.35)', borderRadius:8, color: added ? '#10b981' : TEC_COLORS.gold, fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.2s' }}>
              {added ? '✓' : '+ Cart'}
            </button>
            <button onClick={() => onBuy(product)}
              style={{ padding:'5px 12px', background:`linear-gradient(135deg,${TEC_COLORS.gold},${TEC_COLORS.goldDark})`, border:'none', borderRadius:8, color:'#0a0800', fontSize:11, fontWeight:700, cursor:'pointer' }}>
              Buy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StorePage() {
  const router = useRouter();
  const params = useParams();
  const id     = params?.id as string;

  const [isAuth,    setIsAuth]    = useState(false);
  const [merchant,  setMerchant]  = useState<Merchant | null>(null);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [cartOpen,  setCartOpen]  = useState(false);
  const [piReady,   setPiReady]   = useState(false);
  const { items: cartItems, itemCount, addToCart, removeFromCart, updateQty, clearCart } = useCart();

  useEffect(() => {
    const user  = getStoredUser();
    const token = getAccessToken();
    setIsAuth(!!(user && token));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__TEC_PI_READY) { setPiReady(true); return; }
    const h = () => setPiReady(true);
    window.addEventListener('tec-pi-ready', h, { once: true });
    return () => window.removeEventListener('tec-pi-ready', h);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/bff/store/${id}`, { credentials:'include', cache:'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setMerchant(data.merchant ?? null);
          setProducts(data.products ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleBuy = useCallback((product: Product) => {
    if (!isAuth) { router.push('/shop'); return; }
    // ADR-007: check hub navigation FIRST before any Pi SDK attempt
    if (isHubNavigation() || !(window as any).Pi || !piReady) {
      buyRedirect(product);
      return;
    }
    buyRedirect(product);
  }, [isAuth, piReady, router]);

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#020205', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:'2px solid rgba(212,175,55,0.15)', borderTopColor:TEC_COLORS.gold, animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#020205', color:'#fff', fontFamily:'-apple-system,BlinkMacSystemFont,system-ui,sans-serif', paddingBottom:32 }}>
      <style>{`::-webkit-scrollbar{display:none}`}</style>

      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} items={cartItems} onUpdateQty={updateQty} onRemove={removeFromCart} onClear={clearCart} piReady={piReady} />
      <header style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, background:'rgba(2,2,5,0.95)', backdropFilter:'blur(20px)', zIndex:100, borderBottom:'1px solid #ffffff06' }}>
        <button onClick={() => router.push('/shop')}
          style={{ background:'#ffffff08', border:'1px solid #ffffff10', borderRadius:10, padding:'6px 12px', color:'#6b6b7a', fontSize:14, cursor:'pointer' }}>←</button>
        <div style={{ fontSize:14, fontWeight:700, color:'#fff', flex:1 }}>Merchant Store</div>
        {itemCount > 0 && (
          <button onClick={() => setCartOpen(true)}
            style={{ position:'relative', background:'#ffffff08', border:'1px solid rgba(212,175,55,0.2)', borderRadius:10, padding:'6px 12px', color:TEC_COLORS.gold, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            🛒
            <span style={{ position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', background:'linear-gradient(135deg,#d4af37,#b8882a)', color:'#0a0800', fontSize:10, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>{itemCount}</span>
          </button>
        )}
      </header>

      {merchant ? (
        <div style={{ padding:'24px 16px 16px', background:'linear-gradient(180deg,#0d0d14 0%,#020205 100%)', borderBottom:'1px solid #ffffff06' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'linear-gradient(135deg,#d4af37,#b8882a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:900, color:'#0a0800', flexShrink:0, border:'2px solid rgba(212,175,55,0.3)' }}>
              {merchant.display_name?.[0]?.toUpperCase() ?? '@'}
            </div>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:'#fff' }}>{merchant.display_name}</div>
              <div style={{ fontSize:13, color:TEC_COLORS.gold }}>@{merchant.username}</div>
              {merchant.joined_at && (
                <div style={{ fontSize:11, color:'#4a4a5a', marginTop:2 }}>
                  Member since {formatDate(merchant.joined_at)}
                </div>
              )}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {[
              { label:'Products', value:merchant.products_count },
              { label:'Sales',    value:merchant.sales_count },
              { label:'Rating',   value:`${(merchant.rating ?? 0).toFixed(1)} ★` },
            ].map(s => (
              <div key={s.label} style={{ background:'#ffffff06', borderRadius:12, padding:10, textAlign:'center', border:'1px solid #ffffff08' }}>
                <div style={{ fontSize:16, fontWeight:800, color:TEC_COLORS.gold }}>{s.value}</div>
                <div style={{ fontSize:10, color:'#4a4a5a', marginTop:2, textTransform:'uppercase', letterSpacing:1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding:'24px 16px', textAlign:'center' }}>
          <div style={{ fontSize:40 }}>🏪</div>
          <div style={{ fontSize:14, color:'#4a4a5a', marginTop:8 }}>Merchant not found</div>
        </div>
      )}

      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:12 }}>
          Products ({products.length})
        </div>
        {products.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>📭</div>
            <div style={{ fontSize:14, color:'#4a4a5a' }}>No products yet</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
            {products.map(product => (
              <StoreProductCard key={product.id} product={product} onBuy={handleBuy} onAddToCart={addToCart} onCartOpen={() => setCartOpen(true)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
