'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePiAuth, ssoRedirect }                   from '@yasser172/tec-auth';
import { TEC_COLORS }                               from '@yasser172/tec-ui';
import { createPaymentRecord, createU2APayment }    from '@/lib/pi-payment';
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
  images?: string[]; image_url?: string; currency?: string;
}
type PayStatus = 'idle' | 'creating' | 'paying' | 'success' | 'cancelled' | 'error';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';

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
    return_url: `${APP_URL}/shop`, source: 'ecommerce',
  });
  window.location.href = `${HUB_URL}/hub?${params.toString()}`;
};

export default function ShopPage() {
  const { isAuthenticated, isLoading } = usePiAuth();

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
    fetch('/api/bff/products', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const list = d?.data?.products ?? d?.products ?? [];
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => setProducts([]))
      .finally(() => setFetching(false));
  }, [isAuthenticated]);

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
      if (!internalId) {
        setPayStatus('error');
        setPayMessage('Failed to initialize payment.');
        inFlight.current = false;
        return;
      }

      setPayStatus('paying');
      const result = await createU2APayment(
        product.price, memo,
        { source: 'ecommerce', product_id: product.id },
        internalId,
      );

      if (result.success) {
        fetch('/api/bff/orders', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ product_id: product.id, payment_id: internalId }),
        }).catch(() => {});
        setPayStatus('success');
      } else {
        setPayStatus(result.status === 'cancelled' ? 'cancelled' : 'error');
        setPayMessage(result.message ?? '');
      }
    } catch (err) {
      setPayStatus('error');
      setPayMessage(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      inFlight.current = false;
    }
  }, [piReady]);

  const closeModal = () => { setPayStatus('idle'); setActiveProd(null); setPayMessage(''); inFlight.current = false; };
  const retryPay = () => { const p = activeProd; closeModal(); setTimeout(() => p && handleBuy(p), 100); };

  /* ── unauthenticated ── */
  if (!isAuthenticated) return (
    <div style={{ minHeight:'100vh', background:'#07070f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', animation:'fadeIn 0.5s ease' }}>
        <div style={{ fontSize:52, marginBottom:14 }}>🛍️</div>
        <div style={{ fontSize:26, fontWeight:900, color:TEC_COLORS.gold, marginBottom:6, fontFamily:'Georgia,serif' }}>TEC Store</div>
        <div style={{ fontSize:12, color:'#4a4a5a', fontFamily:'system-ui', marginBottom:32 }}>Login with Pi to browse and buy</div>
        <button
          onClick={() => ssoRedirect(HUB_URL, `${APP_URL}/shop`)}
          disabled={isLoading}
          style={{ padding:'13px 36px', background:`linear-gradient(135deg,${TEC_COLORS.gold},${TEC_COLORS.goldDark})`, border:'none', borderRadius:16, color:'#0a0800', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'system-ui' }}
        >
          {isLoading ? '...' : '🔷 Login with Pi'}
        </button>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );

  /* ── loading products ── */
  if (fetching) return (
    <div style={{ minHeight:'100vh', background:'#07070f', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14 }}>
      <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid rgba(212,175,55,0.15)', borderTopColor:'#d4af37', animation:'spin 0.8s linear infinite' }} />
      <p style={{ fontFamily:'system-ui,sans-serif', fontSize:12, color:'#3a3a4a' }}>Loading products…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#07070f', color:'#fff', fontFamily:'Georgia,serif' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <EcommerceDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} username={username ?? undefined} hubUrl={HUB_URL} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} items={cartItems} onUpdateQty={updateQty} onRemove={removeFromCart} onClear={clearCart} piReady={piReady} />
      <ShopHeader piReady={piReady} onMenuOpen={() => setDrawerOpen(true)} cartCount={itemCount} onCartOpen={() => setCartOpen(true)} />
      <ShopHero />
      <main style={{ maxWidth:800, margin:'0 auto', padding:'8px 16px 48px' }}>
        <ProductGrid products={products} piReady={piReady} onBuy={handleBuy} onAddToCart={addToCart} />
      </main>
      {payStatus !== 'idle' && activeProd && (
        <PaymentModal status={payStatus} product={activeProd} message={payMessage} onClose={closeModal} onRetry={retryPay} />
      )}
    </div>
  );
}
