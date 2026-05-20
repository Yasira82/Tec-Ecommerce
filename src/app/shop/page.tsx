'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPaymentRecord, createU2APayment, PaymentResult } from '@/lib/pi-payment';

interface Product {
  id:         string;
  name:       string;
  description:string;
  price:      number;
  image_url?: string;
  currency:   string;
}

type PayStatus = 'idle' | 'creating' | 'paying' | 'success' | 'cancelled' | 'error';

const HUB_URL  = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';
const SSO_URL  = `${HUB_URL}/api/auth/sso?target=${encodeURIComponent(APP_URL + '/shop')}`;

const getToken = (): string | null =>
  typeof document === 'undefined' ? null :
  document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1] ?? null;

const getCsrfToken = (): string =>
  typeof document === 'undefined' ? '' :
  document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';

export default function ShopPage() {
  const [authed,      setAuthed]      = useState<boolean | null>(null); // null = checking
  const [products,    setProducts]    = useState<Product[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [piReady,     setPiReady]     = useState(false);
  const [payStatus,   setPayStatus]   = useState<PayStatus>('idle');
  const [payMessage,  setPayMessage]  = useState('');
  const [activeProd,  setActiveProd]  = useState<Product | null>(null);
  const inFlight = useRef(false);

  // ── 1. تحقق من الـ auth ──────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = SSO_URL;
      return;
    }
    setAuthed(true);
  }, []);

  // ── 2. Pi SDK ready ──────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__TEC_PI_READY) { setPiReady(true); return; }
    const handler = () => setPiReady(true);
    window.addEventListener('tec-pi-ready', handler, { once: true });
    return () => window.removeEventListener('tec-pi-ready', handler);
  }, []);

  // ── 3. تحميل المنتجات بعد التحقق من الـ auth ────────────
  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const res  = await fetch('/api/bff/products', { credentials: 'include' });
        if (res.status === 401) { window.location.href = SSO_URL; return; }
        const data = await res.json();
        const list = data?.data ?? data?.products ?? data ?? [];
        setProducts(Array.isArray(list) ? list : []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [authed]);

  // ── Buy ──────────────────────────────────────────────────
  const handleBuy = useCallback(async (product: Product) => {
    if (!window.Pi) { alert('Open in Pi Browser'); return; }
    if (!piReady)   { alert('Pi SDK connecting...'); return; }
    if (inFlight.current) return;

    inFlight.current = true;
    setActiveProd(product);
    setPayStatus('creating');
    setPayMessage('');

    try {
      const memo       = `${product.name} — TEC Ecommerce`;
      const internalId = await createPaymentRecord(product.price, product.id, memo);
      if (!internalId) {
        setPayStatus('error');
        setPayMessage('Failed to initialize payment. Please try again.');
        inFlight.current = false;
        return;
      }

      setPayStatus('paying');

      const payResult = await createU2APayment(
        product.price, memo,
        { source: 'ecommerce', product_id: product.id },
        internalId,
      );

      if (payResult.success) {
        try {
          await fetch('/api/bff/orders', {
            method:      'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': getCsrfToken(),
            },
            body: JSON.stringify({ product_id: product.id, payment_id: internalId }),
          });
        } catch {}
        setPayStatus('success');
      } else {
        setPayStatus(payResult.status === 'cancelled' ? 'cancelled' : 'error');
        setPayMessage(payResult.message ?? '');
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

  // ── Loading / Auth check ─────────────────────────────────
  if (authed === null || (authed && loading)) return (
    <div style={{ minHeight: '100vh', background: '#020205', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #d4af3730', borderTop: '3px solid #d4af37', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 12, color: '#4a4a5a' }}>
          {authed === null ? 'Authenticating...' : 'Loading products...'}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#020205', color: '#fff', padding: '24px 16px', fontFamily: 'system-ui,sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#d4af37', marginBottom: 24 }}>🛒 Shop</h1>

      {/* Empty state */}
      {products.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#4a4a5a' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
          <div style={{ fontSize: 14 }}>No products available yet</div>
        </div>
      )}

      {/* Products Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16 }}>
        {products.map(product => (
          <div key={product.id} style={{ borderRadius: 20, background: '#0d0d14', border: '1px solid #d4af3720', overflow: 'hidden' }}>
            {product.image_url && (
              <img src={product.image_url} alt={product.name}
                style={{ width: '100%', height: 140, objectFit: 'cover' }} />
            )}
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{product.name}</div>
              <div style={{ fontSize: 11, color: '#4a4a5a', marginBottom: 12, lineHeight: 1.4 }}>{product.description}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#d4af37', fontFamily: 'Georgia,serif' }}>
                  {product.price}π
                </span>
                <button onClick={() => handleBuy(product)} disabled={!piReady}
                  style={{
                    padding: '8px 16px', borderRadius: 12,
                    background: piReady ? 'linear-gradient(135deg,#d4af37,#b8882a)' : '#333',
                    border: 'none', color: piReady ? '#0a0800' : '#666',
                    fontSize: 12, fontWeight: 700,
                    cursor: piReady ? 'pointer' : 'not-allowed',
                  }}>
                  Buy
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Modal */}
      {payStatus !== 'idle' && activeProd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 340, borderRadius: 28, background: '#0d0d14', border: '1px solid #d4af3730', padding: 32, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px', fontWeight: 900, color: '#0a0800' }}>T</div>
            <div style={{ fontSize: 13, color: '#4a4a5a', marginBottom: 4 }}>{activeProd.name}</div>
            <div style={{ fontSize: 40, fontWeight: 900, color: '#d4af37', fontFamily: 'Georgia,serif', marginBottom: 24 }}>{activeProd.price}π</div>

            {(payStatus === 'creating' || payStatus === 'paying') && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #d4af3730', borderTop: '3px solid #d4af37', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: 13, color: '#6b6b7a' }}>
                  {payStatus === 'creating' ? 'Preparing payment...' : 'Processing in Pi Wallet...'}
                </div>
              </div>
            )}

            {payStatus === 'success' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 48 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#7ee7c0' }}>Payment Successful!</div>
                <button onClick={closeModal} style={{ marginTop: 8, padding: '12px 32px', borderRadius: 14, background: 'linear-gradient(135deg,#d4af37,#b8882a)', border: 'none', color: '#0a0800', fontWeight: 700, cursor: 'pointer' }}>Done</button>
              </div>
            )}

            {payStatus === 'cancelled' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 48 }}>⚠️</div>
                <div style={{ fontSize: 14, color: '#f0c040', marginBottom: 8 }}>Payment Cancelled</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { closeModal(); setTimeout(() => handleBuy(activeProd!), 100); }}
                    style={{ padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg,#d4af37,#b8882a)', border: 'none', color: '#0a0800', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Try Again</button>
                  <button onClick={closeModal} style={{ padding: '10px 20px', borderRadius: 12, background: '#ffffff10', border: '1px solid #ffffff20', color: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                </div>
              </div>
            )}

            {payStatus === 'error' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 48 }}>❌</div>
                <div style={{ fontSize: 14, color: '#e74c3c', marginBottom: 4 }}>Payment Failed</div>
                <div style={{ fontSize: 11, color: '#4a4a5a', marginBottom: 8 }}>{payMessage}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { closeModal(); setTimeout(() => handleBuy(activeProd!), 100); }}
                    style={{ padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg,#d4af37,#b8882a)', border: 'none', color: '#0a0800', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Try Again</button>
                  <button onClick={closeModal} style={{ padding: '10px 20px', borderRadius: 12, background: '#ffffff10', border: '1px solid #ffffff20', color: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
