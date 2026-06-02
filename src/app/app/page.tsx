'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter }              from 'next/navigation';
import { usePiAuth }              from '@yasser172/tec-auth';
import { ShopHeader }             from '@/components/shop/ShopHeader';
import { PaymentModal }           from '@/components/shop/PaymentModal';
import { EcommerceDrawer }        from '@/components/shop/EcommerceDrawer';
import { ShopHero }               from './components/ShopHero';
import { ProductCard, ProductGridCard } from './components/ProductCard';
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
    return_url: `${APP_URL}/app`, source: 'ecommerce',
  });
  window.location.href = `${HUB_URL}/hub?${params.toString()}`;
};

export default function ShopPage() {
  const { isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  const [products,   setProducts]   = useState<Product[]>([]);
  const [fetching,   setFetching]   = useState(true);
  const [piReady,    setPiReady]    = useState(false);
  const [activeTab,  setActiveTab]  = useState('all');
  const [viewMode,   setViewMode]   = useState<'list' | 'grid'>('list');
  const [payStatus,  setPayStatus]  = useState<PayStatus>('idle');
  const [payMessage, setPayMessage] = useState('');
  const [activeProd, setActiveProd] = useState<Product | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [username,   setUsername]   = useState<string | null>(null);
  const inFlight = useRef(false);

  // Pi SDK
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__TEC_PI_READY) { setPiReady(true); return; }
    const h = () => setPiReady(true);
    window.addEventListener('tec-pi-ready', h, { once: true });
    return () => window.removeEventListener('tec-pi-ready', h);
  }, []);

  // SSO redirect
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = `${HUB_URL}/api/auth/sso?target=${encodeURIComponent(APP_URL + '/app')}`;
    }
  }, [isAuthenticated, isLoading]);

  // User info
  useEffect(() => {
    if (isAuthenticated) {
      const user = getStoredUser();
      if (user?.piUsername) setUsername(user.piUsername);
    }
  }, [isAuthenticated]);

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

  const handleView = (product: Product) => {
    router.push(`/product/${product.id}`);
  };

  const closeModal = () => { setPayStatus('idle'); setActiveProd(null); setPayMessage(''); inFlight.current = false; };
  const retryPay   = () => { const p = activeProd; closeModal(); setTimeout(() => p && handleBuy(p), 100); };

  if (!isAuthenticated) return (
    <div style={{ minHeight:'100vh', background:'#07070f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{CSS}</style>
      <div className="spinner" />
    </div>
  );

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[]))];

  return (
    <div style={{ minHeight:'100vh', background:'#07070f', color:'#fff' }}>
      <style>{CSS}</style>

      <EcommerceDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} username={username ?? undefined} hubUrl={HUB_URL} />
      <ShopHeader piReady={piReady} onMenuOpen={() => setDrawerOpen(true)} />
      <ShopHero username={username} />

      {/* ── Categories + View Toggle ── */}
      <div style={{ maxWidth:800, margin:'0 auto', padding:'12px 16px 8px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ display:'flex', gap:6, overflowX:'auto', flex:1, marginRight:8 }}>
            {categories.map(c => (
              <button key={c} onClick={() => setActiveTab(c)} className={`cat-chip ${activeTab === c ? 'cat-chip--on' : ''}`}>
                {c === 'all' ? '✦ All' : c}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:4, flexShrink:0 }}>
            <button onClick={() => setViewMode('list')} className={`view-btn ${viewMode === 'list' ? 'view-btn--on' : ''}`}>☰</button>
            <button onClick={() => setViewMode('grid')} className={`view-btn ${viewMode === 'grid' ? 'view-btn--on' : ''}`}>⊞</button>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:11, color:'#3a3a4a' }}>{products.length} products</span>
        </div>
      </div>

      {/* ── Products ── */}
      <section style={{ maxWidth:800, margin:'0 auto', padding:'8px 16px 80px' }}>
        {fetching ? (
          <div className="center-box"><div className="spinner" /></div>
        ) : products.length === 0 ? (
          <div className="center-box">
            <div style={{ fontSize:48, opacity:0.15, marginBottom:12 }}>📦</div>
            <p style={{ fontSize:13, color:'#3a3a4a' }}>No products available</p>
          </div>
        ) : viewMode === 'list' ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} onBuy={handleBuy} delay={i * 30} />
            ))}
          </div>
        ) : (
          <div className="grid-view">
            {products.map((p, i) => (
              <ProductGridCard key={p.id} product={p} onBuy={handleBuy} delay={i * 40} />
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

const CSS = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  @keyframes spin   { to{transform:rotate(360deg)} }

  .cat-chip {
    padding:6px 14px; border-radius:20px;
    border:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.03);
    color:#6b6b7a; font-size:11px; font-weight:600;
    cursor:pointer; white-space:nowrap; transition:all 0.2s;
  }
  .cat-chip--on {
    background:rgba(212,175,55,0.1); border-color:rgba(212,175,55,0.3); color:#d4af37;
  }

  .view-btn {
    width:32px; height:32px; border-radius:10px;
    border:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.03);
    color:#4a4a5a; font-size:14px; cursor:pointer; transition:all 0.15s;
    display:flex; align-items:center; justify-content:center;
  }
  .view-btn--on { background:rgba(212,175,55,0.1); border-color:rgba(212,175,55,0.25); color:#d4af37; }

  .grid-view { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; }
  .center-box { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 0; }
  .spinner { width:32px; height:32px; border-radius:50%; border:3px solid rgba(212,175,55,0.1); border-top-color:#d4af37; animation:spin 0.8s linear infinite; }
`;
