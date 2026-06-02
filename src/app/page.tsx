'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter }              from 'next/navigation';
import { usePiAuth, ssoRedirect } from '@yasser172/tec-auth';
import { TEC_COLORS }             from '@yasser172/tec-ui';
import { ShopHeader }             from '@/components/shop/ShopHeader';
import { PaymentModal }           from '@/components/shop/PaymentModal';
import { EcommerceDrawer }        from '@/components/shop/EcommerceDrawer';
import { createPaymentRecord, createU2APayment } from '@/lib/pi-payment';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';

interface Product {
  id: string; title: string; name?: string;
  description: string; price: number;
  images?: string[]; image_url?: string;
  category?: string; rating?: number; reviews_count?: number;
}
type PayStatus = 'idle' | 'creating' | 'paying' | 'success' | 'cancelled' | 'error';

const getCsrfToken = () => typeof document === 'undefined' ? '' : document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
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
    return_url: `${APP_URL}/`, source: 'ecommerce',
  });
  window.location.href = `${HUB_URL}/hub?${params.toString()}`;
};

export default function HomePage() {
  const { isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  const [products,   setProducts]   = useState<Product[]>([]);
  const [fetching,   setFetching]   = useState(true);
  const [piReady,    setPiReady]    = useState(false);
  const [activeTab,  setActiveTab]  = useState('all');
  const [payStatus,  setPayStatus]  = useState<PayStatus>('idle');
  const [payMessage, setPayMessage] = useState('');
  const [activeProd, setActiveProd] = useState<Product | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [username,   setUsername]   = useState<string | null>(null);
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
    setFetching(true);
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
    if (inFlight.current) return;
    if (isHubNavigation()) { redirectToHubPayment(product); return; }
    if (!window.Pi || !piReady) { redirectToHubPayment(product); return; }

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

  // ── Landing — Not Authenticated ───────────────────────────
  if (!isAuthenticated) return (
    <div style={{ minHeight:'100vh', background:'#020205', position:'relative', overflow:'hidden' }}>
      <style>{CSS}</style>

      {/* Ambient glow */}
      <div className="landing-glow-1" />
      <div className="landing-glow-2" />

      {/* Top bar */}
      <header className="landing-header">
        <div className="landing-logo">
          <div className="landing-logo-icon">T</div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:'#e8d5a3', letterSpacing:'-0.02em' }}>TEC</div>
            <div style={{ fontSize:8, color:'#4a4a5a', letterSpacing:3, textTransform:'uppercase' }}>Ecommerce</div>
          </div>
        </div>
        <div className="landing-badge-pi">π Network</div>
      </header>

      {/* Hero */}
      <main className="landing-main">
        <div className="landing-icon-ring">
          <div className="landing-icon-inner">🛍</div>
        </div>

        <h1 className="landing-title">
          <span className="landing-title-line1">Shop the</span>
          <span className="landing-title-line2">Future</span>
        </h1>

        <p className="landing-sub">
          The first Web3 marketplace on Pi Network.
          <br />
          One wallet. Instant payments. Zero borders.
        </p>

        <div className="landing-features">
          <div className="landing-feat">
            <span className="landing-feat-icon">⚡</span>
            <span>Instant Pi Payments</span>
          </div>
          <div className="landing-feat">
            <span className="landing-feat-icon">🔒</span>
            <span>Blockchain Secured</span>
          </div>
          <div className="landing-feat">
            <span className="landing-feat-icon">🌍</span>
            <span>Global Access</span>
          </div>
        </div>

        <button className="landing-cta" onClick={() => ssoRedirect(HUB_URL, `${APP_URL}/`)} disabled={isLoading}>
          <span className="landing-cta-pi">π</span>
          {isLoading ? 'Connecting...' : 'Enter with Pi Network'}
        </button>

        <p className="landing-legal">
          TEC Ecosystem · Powered by Pi Network Mainnet
        </p>
      </main>
    </div>
  );

  // ── Authenticated: Shop ───────────────────────────────────
  const featured = products.slice(0, 4);
  const rest     = products.slice(4);
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[]))];

  return (
    <div style={{ minHeight:'100vh', background:'#07070f', color:'#fff' }}>
      <style>{CSS}</style>

      <EcommerceDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} username={username ?? undefined} hubUrl={HUB_URL} />
      <ShopHeader piReady={piReady} onMenuOpen={() => setDrawerOpen(true)} />

      {/* ── Hero ── */}
      <section className="shop-hero">
        <div className="shop-hero-glow" />
        <div className="shop-hero-content">
          <div className="shop-hero-welcome">
            {username && <span className="shop-hero-user">@{username}</span>}
            <span className="shop-hero-dot">·</span>
            <span className="shop-hero-network">π Mainnet</span>
          </div>
          <h1 className="shop-hero-title">Discover & Shop</h1>
          <p className="shop-hero-sub">Premium products, paid instantly with Pi</p>
        </div>
      </section>

      {/* ── Categories ── */}
      {categories.length > 1 && (
        <div className="cat-scroll">
          <div className="cat-track">
            {categories.map(c => (
              <button key={c} onClick={() => setActiveTab(c)}
                className={`cat-chip ${activeTab === c ? 'cat-chip--on' : ''}`}>
                {c === 'all' ? '✦ All' : c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Featured ── */}
      {featured.length > 0 && activeTab === 'all' && (
        <section className="section-wrap">
          <div className="section-bar">
            <h2 className="section-label">✦ Featured</h2>
            <span className="section-num">{featured.length}</span>
          </div>
          <div className="feat-grid">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} onBuy={handleBuy} size="lg" delay={i * 80} />
            ))}
          </div>
        </section>
      )}

      {/* ── All Products ── */}
      <section className="section-wrap" style={{ paddingBottom: 64 }}>
        <div className="section-bar">
          <h2 className="section-label">
            {activeTab === 'all' ? '🛒 All Products' : activeTab}
          </h2>
          <span className="section-num">{products.length} items</span>
        </div>

        {fetching ? (
          <div className="center-box"><div className="spinner" /></div>
        ) : products.length === 0 ? (
          <div className="center-box">
            <div style={{ fontSize:56, opacity:0.15, marginBottom:16 }}>📦</div>
            <p style={{ fontSize:14, color:'#3a3a4a' }}>No products yet</p>
          </div>
        ) : (
          <div className="prod-grid">
            {(activeTab === 'all' && rest.length > 0 ? rest : products).map((p, i) => (
              <ProductCard key={p.id} product={p} onBuy={handleBuy} delay={i * 50} />
            ))}
          </div>
        )}
      </section>

      {payStatus !== 'idle' && activeProd && (
        <PaymentModal status={payStatus} product={activeProd} message={payMessage} onClose={closeModal} onRetry={retryPay} />
      )}
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────
function ProductCard({ product, onBuy, size = 'sm', delay = 0 }: {
  product: Product; onBuy: (p: Product) => void; size?: 'sm' | 'lg'; delay?: number;
}) {
  const imgSrc = product.images?.[0] ?? product.image_url;
  const label  = product.title ?? product.name ?? 'Product';
  const h      = size === 'lg' ? 200 : 160;

  return (
    <article className="pcard" style={{ animationDelay:`${delay}ms` }}>
      <div className="pcard-img-wrap" style={{ height: h }}>
        {imgSrc
          ? <img src={imgSrc} alt={label} className="pcard-img" />
          : <div className="pcard-img-ph" style={{ height: h }}>
              <span style={{ fontSize: size === 'lg' ? 48 : 36 }}>🛍</span>
            </div>
        }
        <div className="pcard-price">{product.price}<span className="pcard-pi">π</span></div>
        {product.category && <div className="pcard-cat">{product.category}</div>}
      </div>

      <div className="pcard-body">
        <h3 className="pcard-title">{label}</h3>
        <p className="pcard-desc">{product.description}</p>

        {product.rating ? (
          <div className="pcard-rating">
            <span className="pcard-stars">
              {'★'.repeat(Math.round(product.rating))}
              {'☆'.repeat(5 - Math.round(product.rating))}
            </span>
            <span className="pcard-reviews">({product.reviews_count ?? 0})</span>
          </div>
        ) : null}

        <button className="pcard-buy" onClick={() => onBuy(product)}>
          Buy Now
        </button>
      </div>
    </article>
  );
}

// ── CSS ───────────────────────────────────────────────────────
const CSS = `
  @keyframes fadeIn   { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
  @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
  @keyframes spin     { to{transform:rotate(360deg)} }
  @keyframes pulse    { 0%,100%{opacity:0.4} 50%{opacity:1} }
  @keyframes ringGlow { 0%,100%{box-shadow:0 0 30px rgba(212,175,55,0.15)} 50%{box-shadow:0 0 60px rgba(212,175,55,0.3)} }

  /* ── Landing ─────────────────────────────────────────────── */
  .landing-glow-1 {
    position:absolute; top:-120px; left:50%; transform:translateX(-50%);
    width:600px; height:400px;
    background:radial-gradient(ellipse, rgba(212,175,55,0.08) 0%, transparent 70%);
    pointer-events:none;
  }
  .landing-glow-2 {
    position:absolute; bottom:-100px; right:-100px;
    width:400px; height:400px;
    background:radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 60%);
    pointer-events:none;
  }
  .landing-header {
    position:relative; display:flex; align-items:center; justify-content:space-between;
    padding:20px 24px; z-index:1;
  }
  .landing-logo { display:flex; align-items:center; gap:10px; }
  .landing-logo-icon {
    width:36px; height:36px; border-radius:12px;
    background:linear-gradient(135deg,#d4af37,#8b6914);
    display:flex; align-items:center; justify-content:center;
    font-size:16px; font-weight:900; color:#07070f;
    box-shadow:0 4px 16px rgba(212,175,55,0.2);
  }
  .landing-badge-pi {
    font-size:10px; color:#d4af37; letter-spacing:1.5px;
    padding:5px 12px; border-radius:20px;
    border:1px solid rgba(212,175,55,0.2);
    background:rgba(212,175,55,0.06);
  }
  .landing-main {
    position:relative; z-index:1;
    display:flex; flex-direction:column; align-items:center;
    padding:40px 24px 60px; text-align:center;
  }
  .landing-icon-ring {
    width:96px; height:96px; border-radius:50%;
    border:2px solid rgba(212,175,55,0.2);
    display:flex; align-items:center; justify-content:center;
    margin-bottom:28px; animation:ringGlow 3s ease-in-out infinite;
  }
  .landing-icon-inner { font-size:44px; }
  .landing-title { margin-bottom:20px; line-height:1; }
  .landing-title-line1 {
    display:block; font-size:16px; font-weight:400; color:#6b6b7a;
    letter-spacing:4px; text-transform:uppercase; margin-bottom:8px;
  }
  .landing-title-line2 {
    display:block; font-size:clamp(44px,10vw,64px); font-weight:900;
    letter-spacing:-0.03em;
    background:linear-gradient(135deg,#d4af37 0%,#e8d5a3 40%,#b8882a 100%);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  }
  .landing-sub {
    font-size:14px; color:#4a4a5a; line-height:1.8; margin-bottom:32px; max-width:300px;
  }
  .landing-features {
    display:flex; gap:20px; margin-bottom:40px; flex-wrap:wrap; justify-content:center;
  }
  .landing-feat {
    display:flex; align-items:center; gap:6px;
    font-size:11px; color:#6b6b7a; letter-spacing:0.5px;
  }
  .landing-feat-icon { font-size:14px; }
  .landing-cta {
    display:flex; align-items:center; justify-content:center; gap:10px;
    padding:16px 40px; border-radius:20px; border:none;
    background:linear-gradient(135deg,#d4af37,#b8882a);
    color:#07070f; font-size:16px; font-weight:800;
    cursor:pointer; transition:transform 0.15s, box-shadow 0.15s;
    box-shadow:0 8px 32px rgba(212,175,55,0.25);
    margin-bottom:24px;
  }
  .landing-cta:hover { transform:translateY(-2px); box-shadow:0 12px 40px rgba(212,175,55,0.35); }
  .landing-cta:active { transform:scale(0.98); }
  .landing-cta-pi {
    font-size:22px; font-weight:900; font-family:Georgia,serif;
    width:32px; height:32px; border-radius:50%;
    background:rgba(7,7,15,0.2);
    display:flex; align-items:center; justify-content:center;
  }
  .landing-legal { font-size:10px; color:#2a2a3a; letter-spacing:1px; }

  /* ── Shop Hero ───────────────────────────────────────────── */
  .shop-hero {
    position:relative; padding:32px 20px 28px; overflow:hidden;
    border-bottom:1px solid rgba(212,175,55,0.06);
  }
  .shop-hero-glow {
    position:absolute; top:-60px; left:50%; transform:translateX(-50%);
    width:500px; height:200px;
    background:radial-gradient(ellipse, rgba(212,175,55,0.08) 0%, transparent 70%);
    pointer-events:none;
  }
  .shop-hero-content { position:relative; max-width:800px; margin:0 auto; }
  .shop-hero-welcome {
    display:flex; align-items:center; gap:8px; margin-bottom:10px;
    font-size:11px; color:#4a4a5a;
  }
  .shop-hero-user { color:#d4af37; font-weight:700; }
  .shop-hero-dot { color:#2a2a3a; }
  .shop-hero-network {
    padding:2px 8px; border-radius:10px; font-size:9px;
    background:rgba(212,175,55,0.08); border:1px solid rgba(212,175,55,0.15); color:#d4af37;
    letter-spacing:0.5px;
  }
  .shop-hero-title {
    font-size:clamp(26px,5vw,36px); font-weight:900; color:#e8d5a3;
    letter-spacing:-0.02em; margin-bottom:4px; font-family:Georgia,serif;
  }
  .shop-hero-sub { font-size:13px; color:#4a4a5a; }

  /* ── Categories ──────────────────────────────────────────── */
  .cat-scroll { max-width:800px; margin:0 auto; padding:0 16px 16px; overflow-x:auto; }
  .cat-track { display:flex; gap:8px; width:max-content; }
  .cat-chip {
    padding:8px 18px; border-radius:24px;
    border:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.03);
    color:#6b6b7a; font-size:12px; font-weight:600;
    cursor:pointer; white-space:nowrap; transition:all 0.2s;
  }
  .cat-chip--on {
    background:rgba(212,175,55,0.1); border-color:rgba(212,175,55,0.3); color:#d4af37;
    box-shadow:0 2px 12px rgba(212,175,55,0.1);
  }

  /* ── Sections ────────────────────────────────────────────── */
  .section-wrap { max-width:800px; margin:0 auto; padding:0 16px 24px; }
  .section-bar { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
  .section-label { font-size:16px; font-weight:800; color:#e8d5a3; font-family:Georgia,serif; }
  .section-num { font-size:11px; color:#3a3a4a; letter-spacing:0.5px; }

  .feat-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:14px; }
  .prod-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; }

  .center-box { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 0; }

  /* ── Product Card ────────────────────────────────────────── */
  .pcard {
    border-radius:20px; overflow:hidden;
    background:#0b0b16; border:1px solid rgba(255,255,255,0.04);
    animation:fadeUp 0.4s ease both;
    transition:transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  }
  .pcard:hover {
    transform:translateY(-4px);
    border-color:rgba(212,175,55,0.2);
    box-shadow:0 16px 48px rgba(0,0,0,0.4), 0 4px 16px rgba(212,175,55,0.06);
  }
  .pcard-img-wrap { position:relative; overflow:hidden; background:#0d0d18; }
  .pcard-img { width:100%; height:100%; object-fit:cover; display:block; transition:transform 0.3s; }
  .pcard:hover .pcard-img { transform:scale(1.05); }
  .pcard-img-ph {
    display:flex; align-items:center; justify-content:center;
    background:linear-gradient(135deg,#0d0d18,#12121f); opacity:0.3;
  }
  .pcard-price {
    position:absolute; bottom:10px; right:10px;
    background:rgba(7,7,15,0.92); backdrop-filter:blur(12px);
    border:1px solid rgba(212,175,55,0.35); color:#d4af37;
    font-size:14px; font-weight:900; font-family:Georgia,serif;
    padding:4px 12px; border-radius:20px;
  }
  .pcard-pi { font-size:12px; margin-left:1px; color:#b8882a; }
  .pcard-cat {
    position:absolute; top:10px; left:10px;
    background:rgba(7,7,15,0.8); backdrop-filter:blur(8px);
    color:#6b6b7a; font-size:8px; font-weight:700;
    padding:3px 10px; border-radius:20px;
    letter-spacing:1.5px; text-transform:uppercase;
  }
  .pcard-body { padding:14px 14px 16px; }
  .pcard-title {
    font-size:13px; font-weight:700; color:#e8d5a3; line-height:1.3;
    margin-bottom:4px; font-family:Georgia,serif;
  }
  .pcard-desc {
    font-size:11px; color:#4a4a5a; line-height:1.5; margin-bottom:10px;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
  }
  .pcard-rating { display:flex; align-items:center; gap:4px; margin-bottom:10px; }
  .pcard-stars { color:#d4af37; font-size:10px; letter-spacing:1px; }
  .pcard-reviews { font-size:9px; color:#3a3a4a; }
  .pcard-buy {
    width:100%; padding:10px; border-radius:14px; border:none;
    background:linear-gradient(135deg,#1a1230,#0f1a2a);
    border:1px solid rgba(212,175,55,0.15);
    color:#d4af37; font-size:12px; font-weight:800;
    cursor:pointer; transition:all 0.2s; letter-spacing:0.5px;
  }
  .pcard-buy:hover {
    background:linear-gradient(135deg,#d4af37,#b8882a);
    color:#07070f; border-color:transparent;
    box-shadow:0 4px 16px rgba(212,175,55,0.2);
  }

  .spinner {
    width:32px; height:32px; border-radius:50%;
    border:3px solid rgba(212,175,55,0.1); border-top-color:#d4af37;
    animation:spin 0.8s linear infinite;
  }
`;
