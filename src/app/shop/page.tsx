'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPaymentRecord, createU2APayment }    from '@/lib/pi-payment';
import { ShopHeader }      from '@/components/shop/ShopHeader';
import { ShopHero }        from '@/components/shop/ShopHero';
import { ProductGrid }     from '@/components/shop/ProductGrid';
import { PaymentModal }    from '@/components/shop/PaymentModal';
import { EcommerceDrawer } from '@/components/shop/EcommerceDrawer';

interface Product {
  id: string; title: string; name?: string;
  description: string; price: number;
  images?: string[]; image_url?: string; currency?: string;
}
type PayStatus = 'idle' | 'creating' | 'paying' | 'success' | 'cancelled' | 'error';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';
const SSO_URL = `${HUB_URL}/api/auth/sso?target=${encodeURIComponent(APP_URL + '/shop')}`;

const getToken     = () => typeof document === 'undefined' ? null : document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1] ?? null;
const getCsrfToken = () => typeof document === 'undefined' ? '' : document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
const getStoredUser = () => {
  try {
    const raw = document.cookie.split('; ').find(r => r.startsWith('tec_user='))?.split('=')?.[1] ?? '';
    return raw ? JSON.parse(decodeURIComponent(raw)) : null;
  } catch { return null; }
};

export default function ShopPage() {
  const [authed,     setAuthed]     = useState<boolean | null>(null);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [piReady,    setPiReady]    = useState(false);
  const [payStatus,  setPayStatus]  = useState<PayStatus>('idle');
  const [payMessage, setPayMessage] = useState('');
  const [activeProd, setActiveProd] = useState<Product | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);         // ✅ Drawer
  const [username,   setUsername]   = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!getToken()) { window.location.href = SSO_URL; return; }
    setAuthed(true);
    const user = getStoredUser();
    if (user?.piUsername) setUsername(user.piUsername);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__TEC_PI_READY) { setPiReady(true); return; }
    const h = () => setPiReady(true);
    window.addEventListener('tec-pi-ready', h, { once: true });
    return () => window.removeEventListener('tec-pi-ready', h);
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetch('/api/bff/products', { credentials: 'include' })
      .then(r => { if (r.status === 401) { window.location.href = SSO_URL; throw new Error(); } return r.json(); })
      .then(d => {
        const list = d?.data?.products ?? d?.products ?? [];
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [authed]);

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

  const closeModal = () => {
    setPayStatus('idle');
    setActiveProd(null);
    setPayMessage('');
    inFlight.current = false;
  };

  const retryPay = () => {
    const p = activeProd;
    closeModal();
    setTimeout(() => p && handleBuy(p), 100);
  };

  if (authed === null || (authed && loading)) return (
    <div style={{ minHeight:'100vh', background:'#07070f', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14 }}>
      <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid rgba(212,175,55,0.15)', borderTopColor:'#d4af37', animation:'spin 0.8s linear infinite' }} />
      <p style={{ fontFamily:'system-ui,sans-serif', fontSize:12, color:'#3a3a4a' }}>
        {authed === null ? 'Authenticating...' : 'Loading products...'}
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#07070f', color:'#fff', fontFamily:'Georgia,serif' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ✅ Drawer */}
      <EcommerceDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        username={username ?? undefined}
        hubUrl={HUB_URL}
      />

      {/* Header */}
      <ShopHeader piReady={piReady} onMenuOpen={() => setDrawerOpen(true)} />

      {/* Hero */}
      <ShopHero />

      {/* Products */}
      <main style={{ maxWidth:800, margin:'0 auto', padding:'8px 16px 48px' }}>
        <ProductGrid products={products} piReady={piReady} onBuy={handleBuy} />
      </main>

      {/* Payment Modal */}
      {payStatus !== 'idle' && activeProd && (
        <PaymentModal
          status={payStatus}
          product={activeProd}
          message={payMessage}
          onClose={closeModal}
          onRetry={retryPay}
        />
      )}
    </div>
  );
      }
