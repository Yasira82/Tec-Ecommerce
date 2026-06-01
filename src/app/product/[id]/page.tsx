'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter }                     from 'next/navigation';
import { usePiAuth }                                from '@yasser172/tec-auth';
import { ShopHeader }                               from '@/components/shop/ShopHeader';
import { PaymentModal }                             from '@/components/shop/PaymentModal';
import { EcommerceDrawer }                          from '@/components/shop/EcommerceDrawer';
import { createPaymentRecord, createU2APayment }    from '@/lib/pi-payment';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';

interface Product {
  id: string; title: string; name?: string;
  description: string; price: number;
  images?: string[]; image_url?: string;
  category?: string; rating?: number;
  reviews_count?: number; merchant_name?: string;
  stock?: number; metadata?: Record<string, unknown>;
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

/** ADR-007: Pi ownership drift after Hub navigation */
const isHubNavigation = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.referrer.toLowerCase().includes('hub.tecosystem.app');
};

/** Mode 1: redirect to Hub PaymentModal (C-76) */
const redirectToHubPayment = (product: Product) => {
  const label = product.title ?? product.name ?? 'Product';
  const params = new URLSearchParams({
    pay:        '1',
    amount:     product.price.toString(),
    memo:       `${label} — TEC Ecommerce`,
    product_id: product.id,
    return_url: `${APP_URL}/product/${product.id}`,
    source:     'ecommerce',
  });
  window.location.href = `${HUB_URL}/hub?${params.toString()}`;
};

export default function ProductPage() {
  const { id }                                 = useParams<{ id: string }>();
  const router                                 = useRouter();
  const { isAuthenticated, isLoading: authLoading } = usePiAuth();

  const [product,    setProduct]    = useState<Product | null>(null);
  const [fetching,   setFetching]   = useState(true);
  const [piReady,    setPiReady]    = useState(false);
  const [activeImg,  setActiveImg]  = useState(0);
  const [payStatus,  setPayStatus]  = useState<PayStatus>('idle');
  const [payMessage, setPayMessage] = useState('');
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

  // Auth
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = `${HUB_URL}/api/auth/sso?target=${encodeURIComponent(APP_URL + `/product/${id}`)}`;
    }
    if (isAuthenticated) {
      const user = getStoredUser();
      if (user?.piUsername) setUsername(user.piUsername);
    }
  }, [isAuthenticated, authLoading, id]);

  // Fetch product
  useEffect(() => {
    if (!id) return;
    if (!getToken()) return;
    fetch(`/api/bff/products/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const p = d?.data?.product ?? d?.product ?? d?.data ?? null;
        if (p) {
          const meta   = (p.metadata ?? {}) as Record<string, unknown>;
          const images = (meta.images as string[]) ?? (p.image_url ? [p.image_url] : []);
          setProduct({ ...p, images });
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [id]);

  const handleBuy = useCallback(async () => {
    if (!product || inFlight.current) return;

    // ✅ ADR-007: Hub navigation → FORCE Mode 1
    if (isHubNavigation()) {
      redirectToHubPayment(product);
      return;
    }

    // ✅ Pi SDK not ready → Mode 1 fallback (was: silent fail)
    if (!window.Pi || !piReady) {
      redirectToHubPayment(product);
      return;
    }

    // ── Mode 2: Direct payment ──
    inFlight.current = true;
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
  }, [product, piReady]);

  const closeModal = () => { setPayStatus('idle'); setPayMessage(''); inFlight.current = false; };
  const retryPay   = () => { closeModal(); setTimeout(handleBuy, 100); };

  // ── Loading ───────────────────────────────────────────────
  if (fetching || authLoading) return (
    <>
      <style>{CSS}</style>
      <div className="center-screen">
        <div className="spinner" />
      </div>
    </>
  );

  if (!product) return (
    <>
      <style>{CSS}</style>
      <div className="center-screen">
        <div style={{ fontSize:48, marginBottom:12, opacity:0.3 }}>📦</div>
        <p style={{ fontFamily:'system-ui', fontSize:14, color:'#4a4a5a', marginBottom:20 }}>Product not found</p>
        <button className="btn-back" onClick={() => router.push('/')}>← Back to Shop</button>
      </div>
    </>
  );

  const images = product.images?.length ? product.images : [];
  const label  = product.title ?? product.name ?? 'Product';

  return (
    <div style={{ minHeight:'100vh', background:'#07070f', color:'#fff', fontFamily:'Georgia,serif' }}>
      <style>{CSS}</style>

      <EcommerceDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} username={username ?? undefined} hubUrl={HUB_URL} />
      <ShopHeader piReady={piReady} onMenuOpen={() => setDrawerOpen(true)} />

      {/* ── Breadcrumb ── */}
      <div className="breadcrumb">
        <button onClick={() => router.push('/')} className="breadcrumb-link">Home</button>
        <span className="breadcrumb-sep">›</span>
        {product.category && <>
          <span className="breadcrumb-link">{product.category}</span>
          <span className="breadcrumb-sep">›</span>
        </>}
        <span className="breadcrumb-current">{label}</span>
      </div>

      <main className="product-wrap">

        {/* ── Images ── */}
        <div className="images-col">
          <div className="main-img-wrap">
            {images.length > 0
              ? <img src={images[activeImg]} alt={label} className="main-img" />
              : <div className="main-img-placeholder">🛍</div>
            }
            <div className="price-overlay">{product.price}π</div>
          </div>
          {images.length > 1 && (
            <div className="thumbs">
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`thumb ${activeImg === i ? 'thumb--active' : ''}`}>
                  <img src={img} alt={`${label} ${i + 1}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Info ── */}
        <div className="info-col">
          {product.category && <span className="category-tag">{product.category}</span>}
          <h1 className="product-title">{label}</h1>

          {product.rating ? (
            <div className="rating-row">
              <span className="stars">{'★'.repeat(Math.round(product.rating))}{'☆'.repeat(5 - Math.round(product.rating))}</span>
              <span className="rating-count">({product.reviews_count ?? 0} reviews)</span>
            </div>
          ) : null}

          <div className="price-block">
            <span className="price-main">{product.price}</span>
            <span className="price-unit">π</span>
          </div>

          <p className="product-desc">{product.description}</p>

          {product.stock !== undefined && (
            <div className={`stock-badge ${product.stock > 0 ? 'stock-in' : 'stock-out'}`}>
              {product.stock > 0 ? `✓ In Stock (${product.stock})` : '✕ Out of Stock'}
            </div>
          )}

          {product.merchant_name && (
            <div className="seller-row">
              <span className="seller-label">Sold by</span>
              <span className="seller-name">@{product.merchant_name}</span>
            </div>
          )}

          {/* Buy Button — always active, handleBuy manages fallback */}
          <button
            className={`cta-btn ${product.stock === 0 ? 'cta-btn--off' : ''}`}
            onClick={handleBuy}
            disabled={product.stock === 0}
          >
            {product.stock === 0 ? 'Out of Stock' : `Buy for ${product.price}π`}
          </button>

          <div className="pi-note">
            <span style={{ color:'#d4af37' }}>π</span>
            &nbsp;Instant payment via Pi Network · Secured by blockchain
          </div>
        </div>

      </main>

      {payStatus !== 'idle' && product && (
        <PaymentModal
          status={payStatus}
          product={{ id: product.id, title: label, price: product.price }}
          message={payMessage}
          onClose={closeModal}
          onRetry={retryPay}
        />
      )}
    </div>
  );
}

const CSS = `
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes spin   { to{transform:rotate(360deg)} }

  .center-screen { min-height:100vh; background:#07070f; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; }
  .spinner { width:32px; height:32px; border-radius:50%; border:3px solid rgba(212,175,55,0.15); border-top-color:#d4af37; animation:spin 0.8s linear infinite; }
  .btn-back { padding:10px 24px; border-radius:12px; border:1px solid rgba(212,175,55,0.2); background:transparent; color:#d4af37; font-family:system-ui; font-size:13px; cursor:pointer; }

  .breadcrumb { max-width:800px; margin:0 auto; padding:14px 20px; display:flex; align-items:center; gap:8px; }
  .breadcrumb-link    { font-family:system-ui; font-size:12px; color:#4a4a5a; background:none; border:none; cursor:pointer; padding:0; }
  .breadcrumb-link:hover { color:#d4af37; }
  .breadcrumb-sep     { color:#2a2a3a; font-size:12px; }
  .breadcrumb-current { font-family:system-ui; font-size:12px; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px; }

  .product-wrap { max-width:800px; margin:0 auto; padding:8px 20px 48px; display:grid; grid-template-columns:1fr; gap:28px; }
  @media(min-width:600px) { .product-wrap { grid-template-columns:1fr 1fr; } }

  .images-col { display:flex; flex-direction:column; gap:10px; }
  .main-img-wrap { position:relative; border-radius:20px; overflow:hidden; background:#0d0d18; border:1px solid rgba(212,175,55,0.1); }
  .main-img { width:100%; height:280px; object-fit:cover; display:block; }
  .main-img-placeholder { height:280px; display:flex; align-items:center; justify-content:center; font-size:64px; opacity:0.2; }
  .price-overlay { position:absolute; bottom:14px; right:14px; background:rgba(7,7,15,0.9); border:1px solid rgba(212,175,55,0.4); color:#d4af37; font-size:18px; font-weight:900; padding:6px 14px; border-radius:20px; font-family:Georgia; backdrop-filter:blur(8px); }
  .thumbs { display:flex; gap:8px; overflow-x:auto; }
  .thumb { width:60px; height:60px; border-radius:12px; overflow:hidden; border:2px solid transparent; cursor:pointer; background:none; padding:0; flex-shrink:0; transition:border-color 0.15s; }
  .thumb--active { border-color:#d4af37; }

  .info-col { display:flex; flex-direction:column; gap:14px; }
  .category-tag { display:inline-block; font-family:system-ui; font-size:10px; color:#d4af37; background:rgba(212,175,55,0.1); border:1px solid rgba(212,175,55,0.2); padding:3px 10px; border-radius:20px; letter-spacing:1px; text-transform:uppercase; width:fit-content; }
  .product-title { font-size:clamp(20px,4vw,28px); font-weight:900; color:#e8d5a3; line-height:1.2; letter-spacing:-0.01em; }
  .rating-row { display:flex; align-items:center; gap:8px; }
  .stars { color:#d4af37; font-size:14px; letter-spacing:1px; }
  .rating-count { font-family:system-ui; font-size:12px; color:#4a4a5a; }
  .price-block { display:flex; align-items:baseline; gap:4px; }
  .price-main { font-size:42px; font-weight:900; color:#d4af37; line-height:1; }
  .price-unit { font-size:22px; font-weight:700; color:#b8882a; }
  .product-desc { font-family:system-ui; font-size:13px; color:#6b6b7a; line-height:1.7; }
  .stock-badge { font-family:system-ui; font-size:12px; font-weight:600; padding:6px 14px; border-radius:20px; width:fit-content; }
  .stock-in  { background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.2); }
  .stock-out { background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); }
  .seller-row { display:flex; align-items:center; gap:8px; }
  .seller-label { font-family:system-ui; font-size:12px; color:#4a4a5a; }
  .seller-name  { font-family:system-ui; font-size:12px; color:#888; font-weight:600; }

  .cta-btn { padding:16px; border-radius:16px; border:none; background:linear-gradient(135deg,#d4af37,#b8882a); color:#07070f; font-size:16px; font-weight:800; font-family:system-ui; cursor:pointer; transition:opacity 0.15s,transform 0.15s; }
  .cta-btn:hover:not(.cta-btn--off) { opacity:0.88; transform:scale(0.99); }
  .cta-btn--off { background:#1a1a28; color:#3a3a4a; cursor:not-allowed; }

  .pi-note { font-family:system-ui; font-size:11px; color:#3a3a4a; text-align:center; padding:10px; background:rgba(212,175,55,0.04); border-radius:12px; border:1px solid rgba(212,175,55,0.08); }
`;
