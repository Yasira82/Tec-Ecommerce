'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter }              from 'next/navigation';
import { ssoRedirect }            from '@yasser172/tec-auth';
import { ShopHeader }             from '@/components/shop/ShopHeader';
import { ShopHero }               from '@/components/shop/ShopHero';
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
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.split('; ').find(r => r.startsWith('tec_user='));
    if (!match) return null;
    const value = match.substring(match.indexOf('=') + 1);
    return JSON.parse(decodeURIComponent(value));
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

export default function ShopPage() {
  const router   = useRouter();
  const inFlight = useRef(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading]             = useState(true);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [fetching,   setFetching]   = useState(true);
  const [piReady,    setPiReady]    = useState(false);
  const [activeTab,  setActiveTab]  = useState('all');
  const [payStatus,  setPayStatus]  = useState<PayStatus>('idle');
  const [payMessage, setPayMessage] = useState('');
  const [activeProd, setActiveProd] = useState<Product | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [username,   setUsername]   = useState<string | null>(null);

  // ══════════════════════════════════════════════════════════
  // AUTH — cookie direct + sessionStorage prevents loop
  // Root cause: usePiAuth calls /auth/refresh → 401 → loop
  // Fix: read tec_user cookie directly, SSO once per tab
  // ══════════════════════════════════════════════════════════
  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setIsAuthenticated(true);
      setUsername(user.piUsername ?? null);
      setIsLoading(false);
      sessionStorage.removeItem('sso_done');
      return;
    }
    if (!sessionStorage.getItem('sso_done')) {
      sessionStorage.setItem('sso_done', '1');
      ssoRedirect(HUB_URL, `${APP_URL}/shop`);
      return;
    }
    setIsLoading(false);
  }, []);

  // Pi SDK
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__TEC_PI_READY) { setPiReady(true); return; }
    const h = () => setPiReady(true);
    window.addEventListener('tec-pi-ready', h, { once: true });
    return () => window.removeEventListener('tec-pi-ready', h);
  }, []);

  // Load products
  useEffect(() => {
    if (!isAuthenticated) return;
    setFetching(true);
    const params = new URLSearchParams({ limit: '50' });
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

  // Payment
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

  // Loading / not authenticated → show spinner (SSO will redirect)
  if (isLoading) return (
    <div style={{ minHeight:'100vh', background:'#07070f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{CSS}</style>
      <div className="spinner" />
    </div>
  );

  if (!isAuthenticated) return (
    <div style={{ minHeight:'100vh', background:'#07070f', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:24 }}>
      <style>{CSS}</style>
      <div style={{ fontSize:48 }}>🛍</div>
      <div style={{ fontSize:20, fontWeight:900, color:'#e8d5a3' }}>TEC Store</div>
      <button onClick={() => { sessionStorage.removeItem('sso_done'); ssoRedirect(HUB_URL, `${APP_URL}/shop`); }}
        style={{ padding:'14px 36px', background:'linear-gradient(135deg,#d4af37,#b8882a)', border:'none', borderRadius:16, color:'#07070f', fontSize:15, fontWeight:800, cursor:'pointer' }}>
        Enter Store
      </button>
      <pre onClick={() => alert(document.cookie)} style={{ fontSize:9, color:'#2a2a3a', cursor:'pointer', textAlign:'center', maxWidth:300, wordBreak:'break-all' }}>
        tap to debug cookies
      </pre>
    </div>
  );

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[]))];

  return (
    <div style={{ minHeight:'100vh', background:'#07070f', color:'#fff' }}>
      <style>{CSS}</style>

      <EcommerceDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} username={username ?? undefined} hubUrl={HUB_URL} />
      <ShopHeader piReady={piReady} onMenuOpen={() => setDrawerOpen(true)} />
      <ShopHero username={username} />

      {categories.length > 1 && (
        <div style={{ maxWidth:800, margin:'0 auto', padding:'12px 16px 8px', overflowX:'auto' }}>
          <div style={{ display:'flex', gap:8, width:'max-content' }}>
            {categories.map(c => (
              <button key={c} onClick={() => setActiveTab(c)} className={`cat-chip ${activeTab === c ? 'cat-chip--on' : ''}`}>
                {c === 'all' ? '✦ All' : c}
              </button>
            ))}
          </div>
        </div>
      )}

      <section style={{ maxWidth:800, margin:'0 auto', padding:'12px 16px 80px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
          <span style={{ fontSize:14, fontWeight:800, color:'#e8d5a3', fontFamily:'Georgia,serif' }}>
            {activeTab === 'all' ? '🛒 All Products' : activeTab}
          </span>
          <span style={{ fontSize:11, color:'#3a3a4a' }}>{products.length} items</span>
        </div>

        {fetching ? (
          <div className="center-box"><div className="spinner" /></div>
        ) : products.length === 0 ? (
          <div className="center-box">
            <div style={{ fontSize:48, opacity:0.15, marginBottom:12 }}>📦</div>
            <p style={{ fontSize:13, color:'#3a3a4a' }}>No products available</p>
          </div>
        ) : (
          <div className="prod-grid">
            {products.map((p, i) => {
              const imgSrc = p.images?.[0] ?? p.image_url;
              const label  = p.title ?? p.name ?? 'Product';
              return (
                <article key={p.id} className="pcard" style={{ animationDelay:`${i * 40}ms` }}
                  onClick={() => router.push(`/product/${p.id}`)}>
                  <div className="pcard-img-wrap">
                    {imgSrc
                      ? <img src={imgSrc} alt={label} className="pcard-img" />
                      : <div className="pcard-ph">🛍</div>
                    }
                    <div className="pcard-price">{p.price}π</div>
                  </div>
                  <div className="pcard-body">
                    <h3 className="pcard-title">{label}</h3>
                    <p className="pcard-desc">{p.description}</p>
                    <button className="pcard-buy" onClick={e => { e.stopPropagation(); handleBuy(p); }}>
                      Buy Now
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {payStatus !== 'idle' && activeProd && (
        <PaymentModal status={payStatus} product={activeProd} message={payMessage} onClose={closeModal} onRetry={retryPay} />
      )}
    </div>
  );
}

const CSS = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  @keyframes spin   { to{transform:rotate(360deg)} }

  .cat-chip {
    padding:7px 16px; border-radius:20px;
    border:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.03);
    color:#6b6b7a; font-size:11px; font-weight:600;
    cursor:pointer; white-space:nowrap; transition:all 0.2s;
  }
  .cat-chip--on {
    background:rgba(212,175,55,0.1); border-color:rgba(212,175,55,0.3); color:#d4af37;
  }

  .prod-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; }

  .pcard {
    border-radius:16px; overflow:hidden;
    background:#0b0b16; border:1px solid rgba(255,255,255,0.04);
    cursor:pointer; animation:fadeUp 0.3s ease both;
    transition:transform 0.2s, border-color 0.2s;
  }
  .pcard:active { transform:scale(0.98); }

  .pcard-img-wrap { height:110px; position:relative; overflow:hidden; background:#0d0d18; }
  .pcard-img { width:100%; height:100%; object-fit:cover; }
  .pcard-ph { height:100%; display:flex; align-items:center; justify-content:center; font-size:32px; opacity:0.15; }
  .pcard-price {
    position:absolute; bottom:6px; right:6px;
    background:rgba(7,7,15,0.9); backdrop-filter:blur(8px);
    border:1px solid rgba(212,175,55,0.3); color:#d4af37;
    font-size:11px; font-weight:900; font-family:Georgia,serif;
    padding:2px 8px; border-radius:12px;
  }
  .pcard-body { padding:10px; }
  .pcard-title {
    font-size:12px; font-weight:700; color:#e8d5a3;
    margin-bottom:3px; font-family:Georgia,serif;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .pcard-desc {
    font-size:10px; color:#4a4a5a; line-height:1.4; margin-bottom:8px;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
  }
  .pcard-buy {
    width:100%; padding:8px; border-radius:12px; border:none;
    background:linear-gradient(135deg,#1a1230,#0f1a2a);
    border:1px solid rgba(212,175,55,0.15);
    color:#d4af37; font-size:11px; font-weight:700;
    cursor:pointer; transition:all 0.2s;
  }
  .pcard-buy:active {
    background:linear-gradient(135deg,#d4af37,#b8882a);
    color:#07070f;
  }

  .center-box { display:flex; flex-direction:column; align-items:center; padding:60px 0; }
  .spinner { width:32px; height:32px; border-radius:50%; border:3px solid rgba(212,175,55,0.1); border-top-color:#d4af37; animation:spin 0.8s linear infinite; }
`;
