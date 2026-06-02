'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter }              from 'next/navigation';
import { usePiAuth, ssoRedirect } from '@yasser172/tec-auth';
import { TEC_COLORS }             from '@yasser172/tec-ui';
import { ShopHeader }             from '@/components/shop/ShopHeader';
import { PaymentModal }           from '@/components/shop/PaymentModal';
import { EcommerceDrawer }        from '@/components/shop/EcommerceDrawer';
import { createPaymentRecord, createU2APayment } from '@/lib/pi-payment';

const HUB_URL   = process.env.NEXT_PUBLIC_HUB_URL  ?? 'https://hub.tecosystem.app';
const APP_URL   = process.env.NEXT_PUBLIC_APP_URL  ?? 'https://ecommerce.tecosystem.app';

interface Product {
  id: string; title: string; name?: string;
  description: string; price: number;
  images?: string[]; image_url?: string;
  category?: string; rating?: number; reviews_count?: number;
}
type PayStatus = 'idle' | 'creating' | 'paying' | 'success' | 'cancelled' | 'error';

const getToken     = () => typeof document === 'undefined' ? null : document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1] ?? null;
const getCsrfToken = () => typeof document === 'undefined' ? '' : document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
const getStoredUser = () => {
  try {
    const raw = document.cookie.split('; ').find(r => r.startsWith('tec_user='))?.split('=')?.[1] ?? '';
    return raw ? JSON.parse(decodeURIComponent(raw)) : null;
  } catch { return null; }
};

export default function HomePage() {
  const { isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  const [products,    setProducts]    = useState<Product[]>([]);
  const [fetching,    setFetching]    = useState(true);
  const [piReady,     setPiReady]     = useState(false);
  const [activeTab,   setActiveTab]   = useState<string>('all');
  const [payStatus,   setPayStatus]   = useState<PayStatus>('idle');
  const [payMessage,  setPayMessage]  = useState('');
  const [activeProd,  setActiveProd]  = useState<Product | null>(null);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [username,    setUsername]    = useState<string | null>(null);
  const [piReady2,    setPiReady2]    = useState(false);
  const inFlight = useRef(false);

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
    const params = new URLSearchParams({ limit: '20' });
    if (activeTab !== 'all') params.set('category', activeTab);
    fetch(`/api/bff/products?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const list = d?.data?.products ?? d?.products ?? [];
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => setProducts([]))
      .finally(() => setFetching(false));
  }, [isAuthenticated, activeTab]);

  const handleBuy = useCallback(async (product: Product) => {
    if (!window.Pi || !piReady || inFlight.current) return;
    inFlight.current = true;
    setActiveProd(product);
    setPayStatus('creating');
    setPayMessage('');
    try {
      const label      = product.title ?? product.name ?? 'Product';
      const memo       = `${label} — TEC Ecommerce`;
      const internalId = await createPaymentRecord(product.price, product.id, memo);
      if (!internalId) { setPayStatus('error'); setPayMessage('Failed to initialize.'); inFlight.current = false; return; }
      setPayStatus('paying');
      const result = await createU2APayment(product.price, memo, { source: 'ecommerce', product_id: product.id }, internalId);
      if (result.success) {
        fetch('/api/bff/orders', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json','x-csrf-token':getCsrfToken()}, body: JSON.stringify({ product_id: product.id, payment_id: internalId }) }).catch(() => {});
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

  if (!isAuthenticated) return (
    <div style={{ minHeight:'100vh', background:'#020205', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{CSS}</style>
      <div style={{ textAlign:'center', animation:'fadeIn 0.5s ease' }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🛍️</div>
        <div style={{ fontSize:28, fontWeight:900, color: TEC_COLORS.gold, marginBottom:6 }}>TEC Store</div>
        <div style={{ fontSize:13, color: TEC_COLORS.subtext, marginBottom:8 }}>ECOMMERCE · TEC ECOSYSTEM</div>
        <div style={{ fontSize:12, color:'#2a2a3a', marginBottom:36 }}>Shop with Pi — One Identity, One Wallet</div>
        <button onClick={() => ssoRedirect(HUB_URL, `${APP_URL}/`)} disabled={isLoading}
          style={{ padding:'14px 36px', background:`linear-gradient(135deg,${TEC_COLORS.gold},${TEC_COLORS.goldDark})`, border:'none', borderRadius:16, color:'#0a0800', fontSize:15, fontWeight:800, cursor:'pointer' }}>
          {isLoading ? '...' : '🔷 Login with Pi'}
        </button>
      </div>
    </div>
  );

  const featured = products.slice(0, 4);
  const rest     = products.slice(4);
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[]))];

  return (
    <div style={{ minHeight:'100vh', background:'#07070f', color:'#fff', fontFamily:'Georgia,serif' }}>
      <style>{CSS}</style>
      <EcommerceDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} username={username ?? undefined} hubUrl={HUB_URL} />
      <ShopHeader piReady={piReady} onMenuOpen={() => setDrawerOpen(true)} />
      <section className="hero-banner">
        <div className="hero-glow" />
        <div className="hero-content">
          <p className="hero-eyebrow">Pi Network · Web3 Shopping</p>
          <h1 className="hero-title">Shop the Future</h1>
          <p className="hero-sub">Pay instantly with Pi — no middlemen, no borders</p>
          <button className="hero-cta" onClick={() => document.getElementById('all-products')?.scrollIntoView({ behavior:'smooth' })}>Explore Products →</button>
        </div>
        <div className="hero-badge">
          <span className="hero-badge-icon">π</span>
          <div>
            <div style={{ fontSize:10, color:'#4a4a5a' }}>Pay with</div>
            <div style={{ fontSize:14, fontWeight:800, color:'#d4af37' }}>Pi Network</div>
          </div>
        </div>
      </section>
      {featured.length > 0 && (
        <section style={{ maxWidth:800, margin:'0 auto', padding:'0 16px 32px' }}>
          <div className="section-header"><h2 className="section-title">⭐ Featured</h2><span className="section-count">{featured.length} items</span></div>
          <div className="featured-grid">
            {featured.map((p, i) => <ProductCard key={p.id} product={p} piReady={piReady} onBuy={handleBuy} featured delay={i * 80} />)}
          </div>
        </section>
      )}
      {categories.length > 1 && (
        <div style={{ maxWidth:800, margin:'0 auto', padding:'0 16px 20px', overflowX:'auto' }}>
          <div style={{ display:'flex', gap:8, width:'max-content' }}>
            {categories.map(c => (<button key={c} onClick={() => setActiveTab(c)} className={`cat-btn ${activeTab === c ? 'cat-btn--active' : ''}`}>{c === 'all' ? '🏪 All' : c}</button>))}
          </div>
        </div>
      )}
      <section id="all-products" style={{ maxWidth:800, margin:'0 auto', padding:'0 16px 48px' }}>
        <div className="section-header"><h2 className="section-title">🛒 {activeTab === 'all' ? 'All Products' : activeTab}</h2><span className="section-count">{products.length} items</span></div>
        {fetching ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'48px 0' }}><div className="spinner" /></div>
        ) : products.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0' }}><div style={{ fontSize:48, opacity:0.3, marginBottom:12 }}>📦</div><p style={{ fontFamily:'system-ui', fontSize:14, color:'#3a3a4a' }}>No products yet</p></div>
        ) : (
          <div className="products-grid">
            {(rest.length > 0 ? rest : products).map((p, i) => (<ProductCard key={p.id} product={p} piReady={piReady} onBuy={handleBuy} delay={i * 60} />))}
          </div>
        )}
      </section>
      {payStatus !== 'idle' && activeProd && (<PaymentModal status={payStatus} product={activeProd} message={payMessage} onClose={closeModal} onRetry={retryPay} />)}
    </div>
  );
}

function ProductCard({ product, piReady, onBuy, featured = false, delay = 0 }: { product: Product; piReady: boolean; onBuy: (p: Product) => void; featured?: boolean; delay?: number; }) {
  const imgSrc = product.images?.[0] ?? product.image_url;
  const label  = product.title ?? product.name ?? 'Product';
  const height = featured ? 180 : 140;
  return (
    <article className="card" style={{ animationDelay:`${delay}ms` }}>
      <div style={{ position:'relative' }}>
        {imgSrc ? <img src={imgSrc} alt={label} style={{ width:'100%', height, objectFit:'cover', display:'block' }} /> : <div style={{ width:'100%', height, background:'linear-gradient(135deg,#0d0d18,#141428)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: featured ? 44 : 32, opacity:0.3 }}>🛍</div>}
        <div className="price-badge">{product.price}π</div>
        {product.category && <div className="cat-badge">{product.category}</div>}
      </div>
      <div style={{ padding: featured ? '16px' : '12px' }}>
        <h3 className="card-title" style={{ fontSize: featured ? 15 : 13 }}>{label}</h3>
        <p className="card-desc">{product.description}</p>
        {product.rating ? (<div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:10 }}><span style={{ color:'#d4af37', fontSize:11 }}>{'★'.repeat(Math.round(product.rating))}</span><span style={{ fontFamily:'system-ui', fontSize:10, color:'#4a4a5a' }}>({product.reviews_count ?? 0})</span></div>) : null}
        <button className={`buy-btn ${!piReady ? 'buy-btn--off' : ''}`} onClick={() => piReady && onBuy(product)} disabled={!piReady}>{piReady ? 'Buy Now' : 'Connecting...'}</button>
      </div>
    </article>
  );
}

const CSS = `
  @keyframes fadeIn  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  .hero-banner { position:relative; overflow:hidden; padding:56px 20px 48px; text-align:center; background:linear-gradient(180deg,#0a0a18 0%,#07070f 100%); border-bottom:1px solid rgba(212,175,55,0.08); }
  .hero-glow { position:absolute; top:-80px; left:50%; transform:translateX(-50%); width:500px; height:300px; background:radial-gradient(ellipse,rgba(212,175,55,0.12) 0%,transparent 70%); pointer-events:none; }
  .hero-content { position:relative; max-width:500px; margin:0 auto; }
  .hero-eyebrow { font-family:system-ui; font-size:10px; color:#4a4a5a; letter-spacing:3px; text-transform:uppercase; margin-bottom:12px; }
  .hero-title { font-size:clamp(32px,7vw,52px); font-weight:900; letter-spacing:-0.03em; background:linear-gradient(135deg,#d4af37,#e8d5a3,#b8882a); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; margin-bottom:12px; }
  .hero-sub { font-family:system-ui; font-size:14px; color:#4a4a5a; margin-bottom:28px; }
  .hero-cta { padding:13px 32px; border-radius:14px; border:none; background:linear-gradient(135deg,#d4af37,#b8882a); color:#07070f; font-size:14px; font-weight:800; font-family:system-ui; cursor:pointer; }
  .hero-badge { position:absolute; top:20px; right:20px; display:flex; align-items:center; gap:8px; padding:8px 14px; background:rgba(212,175,55,0.08); border:1px solid rgba(212,175,55,0.2); border-radius:20px; }
  .hero-badge-icon { font-size:20px; font-weight:900; color:#d4af37; font-family:Georgia; }
  .section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .section-title { font-size:18px; font-weight:800; color:#e8d5a3; }
  .section-count { font-family:system-ui; font-size:11px; color:#4a4a5a; }
  .featured-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:16px; }
  .products-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:14px; }
  .cat-btn { padding:7px 16px; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); color:#6b6b7a; font-family:system-ui; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap; transition:all 0.15s; }
  .cat-btn--active { background:rgba(212,175,55,0.12); border-color:rgba(212,175,55,0.35); color:#d4af37; }
  .card { border-radius:18px; background:#0d0d18; border:1px solid rgba(212,175,55,0.1); overflow:hidden; animation:fadeUp 0.4s ease both; transition:transform 0.2s,border-color 0.2s,box-shadow 0.2s; }
  .card:hover { transform:translateY(-4px); border-color:rgba(212,175,55,0.3); box-shadow:0 12px 36px rgba(212,175,55,0.07); }
  .price-badge { position:absolute; top:10px; right:10px; background:rgba(7,7,15,0.88); border:1px solid rgba(212,175,55,0.4); color:#d4af37; font-size:12px; font-weight:900; padding:3px 9px; border-radius:20px; font-family:Georgia; backdrop-filter:blur(8px); }
  .cat-badge { position:absolute; top:10px; left:10px; background:rgba(7,7,15,0.75); color:#6b6b7a; font-family:system-ui; font-size:9px; padding:3px 8px; border-radius:20px; text-transform:uppercase; letter-spacing:1px; }
  .card-title { font-weight:700; color:#e8d5a3; line-height:1.3; margin-bottom:5px; }
  .card-desc { font-family:system-ui; font-size:11px; color:#4a4a5a; line-height:1.5; margin-bottom:12px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .buy-btn { width:100%; padding:10px; border-radius:12px; border:none; background:linear-gradient(135deg,#d4af37,#b8882a); color:#07070f; font-size:12px; font-weight:800; font-family:system-ui; cursor:pointer; transition:opacity 0.15s; }
  .buy-btn:hover:not(.buy-btn--off) { opacity:0.88; }
  .buy-btn--off { background:#1a1a28; color:#3a3a4a; cursor:not-allowed; }
  .spinner { width:32px; height:32px; border-radius:50%; border:3px solid rgba(212,175,55,0.15); border-top-color:#d4af37; animation:spin 0.8s linear infinite; }
`;
