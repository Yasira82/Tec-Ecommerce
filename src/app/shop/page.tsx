'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { usePiAuth, ssoRedirect }                            from '@yasser172/tec-auth';
import { TEC_COLORS }                                        from '@yasser172/tec-ui';
import { createPaymentRecord, createU2APayment }             from '@/lib/pi-payment';
import { ShopHeader }      from '@/components/shop/ShopHeader';
import { ShopHero }        from '@/components/shop/ShopHero';
import { ProductGrid }     from '@/components/shop/ProductGrid';
import { PaymentModal }    from '@/components/shop/PaymentModal';
import { EcommerceDrawer } from '@/components/shop/EcommerceDrawer';
import { CartDrawer }      from '@/components/shop/CartDrawer';
import { useCart }         from '@/lib-client/cart/useCart';

interface Product {
  id: string; title: string; name?: string;
  description: string; price: number;
  images?: string[]; image_url?: string;
  category?: string; rating?: number; reviews_count?: number;
}
type PayStatus = 'idle' | 'creating' | 'paying' | 'success' | 'cancelled' | 'error';
type SortKey   = 'default' | 'price-asc' | 'price-desc' | 'rating';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';

const getCsrfToken  = () => typeof document === 'undefined' ? '' : document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
const getStoredUser = () => {
  try {
    const raw = document.cookie.split('; ').find(r => r.startsWith('tec_user='))?.split('=')?.[1] ?? '';
    return raw ? JSON.parse(decodeURIComponent(raw)) : null;
  } catch { return null; }
};

const isHubNavigation = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.referrer.toLowerCase().includes('hub.tecosystem.app');
};

const redirectToHubPayment = (product: Product) => {
  const label = product.title ?? product.name ?? 'Product';
  const params = new URLSearchParams({
    pay: '1', amount: product.price.toString(),
    memo: `${label} — TEC Ecommerce`, product_id: product.id,
    return_url: `${APP_URL}/shop`, source: 'ecommerce',
  });
  window.location.href = `${HUB_URL}/hub?${params.toString()}`;
};

const PRICE_BUCKETS = [
  { label: 'All',   max: null },
  { label: '≤ 5π',  max: 5 },
  { label: '≤ 10π', max: 10 },
  { label: '≤ 50π', max: 50 },
];

export default function ShopPage() {
  const { isAuthenticated: piAuthed, isLoading: piLoading } = usePiAuth();
  const [tokenReady, setTokenReady] = useState(false);
  useEffect(() => {
    const tok = document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1];
    if (tok && tok.trim()) setTokenReady(true);
  }, []);
  const isLoading       = piLoading && !tokenReady;
  const isAuthenticated = piAuthed  || tokenReady;

  const [products,   setProducts]   = useState<Product[]>([]);
  const [fetching,   setFetching]   = useState(true);
  const [piReady,    setPiReady]    = useState(false);
  const [payStatus,  setPayStatus]  = useState<PayStatus>('idle');
  const [payMessage, setPayMessage] = useState('');
  const [activeProd, setActiveProd] = useState<Product | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartOpen,   setCartOpen]   = useState(false);
  const [username,   setUsername]   = useState<string | null>(null);
  const inFlight = useRef(false);
  const { items: cartItems, itemCount, addToCart, removeFromCart, updateQty, clearCart } = useCart();

  const [searchQuery,    setSearchQuery]    = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy,         setSortBy]         = useState<SortKey>('default');
  const [maxPriceBucket, setMaxPriceBucket] = useState<number | null>(null);
  const [customMax,      setCustomMax]      = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (v: string) => {
    setSearchQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(v), 280);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__TEC_PI_READY) { setPiReady(true); return; }
    const h = () => setPiReady(true);
    window.addEventListener('tec-pi-ready', h, { once: true });
    return () => window.removeEventListener('tec-pi-ready', h);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const user = getStoredUser();
      if (user?.piUsername) setUsername(user.piUsername);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/bff/products?limit=60', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const list = d?.data?.products ?? d?.products ?? [];
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => setProducts([]))
      .finally(() => setFetching(false));
  }, [isAuthenticated]);

  const categories = useMemo(() =>
    ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[]))],
    [products],
  );

  const effectiveMax = useMemo(() => {
    if (customMax !== '' && Number(customMax) > 0) return Number(customMax);
    return maxPriceBucket;
  }, [customMax, maxPriceBucket]);

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      list = list.filter(p =>
        (p.title ?? p.name ?? '').toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
      );
    }
    if (activeCategory !== 'all') list = list.filter(p => p.category === activeCategory);
    if (effectiveMax !== null)    list = list.filter(p => p.price <= effectiveMax);
    switch (sortBy) {
      case 'price-asc':  list.sort((a, b) => a.price - b.price); break;
      case 'price-desc': list.sort((a, b) => b.price - a.price); break;
      case 'rating':     list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); break;
    }
    return list;
  }, [products, debouncedQuery, activeCategory, effectiveMax, sortBy]);

  const hasActiveFilters = debouncedQuery || activeCategory !== 'all' || effectiveMax !== null || sortBy !== 'default';

  const clearAllFilters = () => {
    setSearchQuery(''); setDebouncedQuery('');
    setActiveCategory('all'); setSortBy('default');
    setMaxPriceBucket(null); setCustomMax('');
  };

  const handleBuy = useCallback(async (product: Product) => {
    if (inFlight.current) return;
    if (isHubNavigation() || !window.Pi || !piReady) { redirectToHubPayment(product); return; }
    inFlight.current = true;
    setActiveProd(product);
    setPayStatus('creating');
    setPayMessage('');
    try {
      const label      = product.title ?? product.name ?? 'Product';
      const memo       = `${label} — TEC Ecommerce`;
      const internalId = await createPaymentRecord(product.price, product.id, memo);
      if (!internalId) { setPayStatus('error'); setPayMessage('Failed to initialize payment.'); inFlight.current = false; return; }
      setPayStatus('paying');
      const result = await createU2APayment(product.price, memo, { source: 'ecommerce', product_id: product.id }, internalId);
      if (result.success) {
        fetch('/api/bff/orders', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() }, body: JSON.stringify({ product_id: product.id, payment_id: internalId }) }).catch(() => {});
        setPayStatus('success');
      } else {
        setPayStatus(result.status === 'cancelled' ? 'cancelled' : 'error');
        setPayMessage(result.message ?? '');
      }
    } catch (err) {
      setPayStatus('error');
      setPayMessage(err instanceof Error ? err.message : 'Payment failed');
    } finally { inFlight.current = false; }
  }, [piReady]);

  const closeModal = () => { setPayStatus('idle'); setActiveProd(null); setPayMessage(''); inFlight.current = false; };
  const retryPay   = () => { const p = activeProd; closeModal(); setTimeout(() => p && handleBuy(p), 100); };

  if (isLoading) return (
    <div style={{ minHeight:'100vh', background:'#07070f', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14 }}>
      <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid rgba(212,175,55,0.15)', borderTopColor:'#d4af37', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!isAuthenticated) return (
    <div style={{ minHeight:'100vh', background:'#07070f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', animation:'fadeIn 0.5s ease' }}>
        <div style={{ fontSize:52, marginBottom:14 }}>🛍️</div>
        <div style={{ fontSize:26, fontWeight:900, color:TEC_COLORS.gold, marginBottom:6, fontFamily:'Georgia,serif' }}>TEC Store</div>
        <div style={{ fontSize:12, color:'#4a4a5a', fontFamily:'system-ui', marginBottom:32 }}>Login with Pi to browse and buy</div>
        <button
          onClick={() => ssoRedirect(HUB_URL, `${APP_URL}/shop`)}
          style={{ padding:'13px 36px', background:`linear-gradient(135deg,${TEC_COLORS.gold},${TEC_COLORS.goldDark})`, border:'none', borderRadius:16, color:'#0a0800', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'system-ui' }}
        >
          🔷 Login with Pi
        </button>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );

  if (fetching) return (
    <div style={{ minHeight:'100vh', background:'#07070f', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14 }}>
      <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid rgba(212,175,55,0.15)', borderTopColor:'#d4af37', animation:'spin 0.8s linear infinite' }} />
      <p style={{ fontFamily:'system-ui,sans-serif', fontSize:12, color:'#3a3a4a' }}>Loading products…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#07070f', color:'#fff', fontFamily:'Georgia,serif' }}>
      <style>{CSS}</style>
      <EcommerceDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} username={username ?? undefined} hubUrl={HUB_URL} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} items={cartItems} onUpdateQty={updateQty} onRemove={removeFromCart} onClear={clearCart} piReady={piReady} />
      <ShopHeader piReady={piReady} onMenuOpen={() => setDrawerOpen(true)} cartCount={itemCount} onCartOpen={() => setCartOpen(true)} />
      <ShopHero />
      <main style={{ maxWidth:800, margin:'0 auto', padding:'16px 16px 48px' }}>
        <div style={{ position:'relative', marginBottom:14 }}>
          <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'#4a4a5a', pointerEvents:'none' }}>🔍</span>
          <input type="text" value={searchQuery} onChange={e => handleSearchChange(e.target.value)} placeholder="Search products…"
            style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px 11px 38px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, color:'#e8d5a3', fontFamily:'system-ui', fontSize:13, outline:'none', transition:'border-color 0.15s' }}
            onFocus={e => (e.target.style.borderColor = 'rgba(212,175,55,0.4)')}
            onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
          />
          {searchQuery && <button onClick={() => handleSearchChange('')} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#4a4a5a', cursor:'pointer', fontSize:16, lineHeight:1 }}>×</button>}
        </div>
        {categories.length > 1 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:6, overflowX:'auto', flexShrink:1 }}>
              {categories.map(c => (
                <button key={c} onClick={() => setActiveCategory(c)}
                  style={{ padding:'6px 14px', borderRadius:20, fontFamily:'system-ui', fontSize:12, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer', transition:'all 0.15s',
                    background: activeCategory === c ? 'rgba(212,175,55,0.14)' : 'rgba(255,255,255,0.04)',
                    border:     activeCategory === c ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    color:      activeCategory === c ? '#d4af37' : '#6b6b7a' }}>
                  {c === 'all' ? '🏪 All' : c}
                </button>
              ))}
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}
              style={{ padding:'7px 10px', borderRadius:10, fontFamily:'system-ui', fontSize:12, fontWeight:600, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#6b6b7a', cursor:'pointer', flexShrink:0, WebkitAppearance:'none', appearance:'none' }}>
              <option value="default">⇅ Sort</option>
              <option value="price-asc">Price: Low → High</option>
              <option value="price-desc">Price: High → Low</option>
              <option value="rating">⭐ Top Rated</option>
            </select>
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:16, flexWrap:'wrap' }}>
          <span style={{ fontFamily:'system-ui', fontSize:11, color:'#4a4a5a', flexShrink:0 }}>Price:</span>
          {PRICE_BUCKETS.map(b => {
            const active = b.max === maxPriceBucket && customMax === '';
            return (
              <button key={b.label} onClick={() => { setMaxPriceBucket(b.max); setCustomMax(''); }}
                style={{ padding:'4px 12px', borderRadius:20, fontFamily:'system-ui', fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
                  background: active ? 'rgba(212,175,55,0.14)' : 'rgba(255,255,255,0.04)',
                  border:     active ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  color:      active ? '#d4af37' : '#6b6b7a' }}>
                {b.label}
              </button>
            );
          })}
          <input type="number" min={1} placeholder="Max π" value={customMax} onChange={e => { setCustomMax(e.target.value); setMaxPriceBucket(null); }}
            style={{ width:68, padding:'4px 8px', borderRadius:10, fontFamily:'system-ui', fontSize:11, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#e8d5a3', outline:'none' }} />
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <span style={{ fontFamily:'system-ui', fontSize:12, color:'#4a4a5a' }}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
            {hasActiveFilters && products.length !== filteredProducts.length && <span style={{ color:'#6b6b7a' }}> of {products.length}</span>}
          </span>
          {hasActiveFilters && (
            <button onClick={clearAllFilters} style={{ fontFamily:'system-ui', fontSize:11, color:'#4a4a5a', background:'none', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'3px 10px', cursor:'pointer' }}>✕ Clear filters</button>
          )}
        </div>
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ fontSize:44, opacity:0.25, marginBottom:12 }}>🔍</div>
            <p style={{ fontFamily:'system-ui', fontSize:14, color:'#3a3a4a', marginBottom:16 }}>No products match your filters</p>
            <button onClick={clearAllFilters} style={{ fontFamily:'system-ui', fontSize:12, color:'#d4af37', background:'none', border:'1px solid rgba(212,175,55,0.25)', borderRadius:10, padding:'8px 18px', cursor:'pointer' }}>Clear filters</button>
          </div>
        ) : (
          <ProductGrid products={filteredProducts} piReady={piReady} onBuy={handleBuy} onAddToCart={addToCart} />
        )}
      </main>
      {payStatus !== 'idle' && activeProd && (
        <PaymentModal status={payStatus} product={activeProd} message={payMessage} onClose={closeModal} onRetry={retryPay} />
      )}
    </div>
  );
}

const CSS = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
  input[type=number] { -moz-appearance:textfield; }
  input::placeholder { color:#3a3a4a; }
`;
