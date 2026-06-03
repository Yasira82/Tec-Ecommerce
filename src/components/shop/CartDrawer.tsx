'use client';

import { useState, useRef }          from 'react';
import { useRouter }                  from 'next/navigation';
import { CartItem }                   from '@/lib-client/cart/useCart';
import { createPaymentRecord, createU2APayment } from '@/lib/pi-payment';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';

const getCsrfToken = () =>
  typeof document === 'undefined'
    ? ''
    : document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';

const isHubNavigation = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.referrer.toLowerCase().includes('hub.tecosystem.app');
};

const redirectToHubPayment = (total: number, count: number) => {
  const memo = `TEC Cart — ${count} item${count !== 1 ? 's' : ''}`;
  const params = new URLSearchParams({
    pay: '1', amount: total.toString(),
    memo, product_id: 'cart_checkout',
    return_url: `${APP_URL}/orders`, source: 'ecommerce',
  });
  window.location.href = `${HUB_URL}/hub?${params.toString()}`;
};

type CheckoutStatus = 'idle' | 'creating' | 'paying' | 'success' | 'error' | 'cancelled';

interface Props {
  isOpen:       boolean;
  onClose:      () => void;
  items:        CartItem[];
  onUpdateQty:  (productId: string, qty: number) => void;
  onRemove:     (productId: string) => void;
  onClear:      () => void;
  piReady:      boolean;
}

export function CartDrawer({ isOpen, onClose, items, onUpdateQty, onRemove, onClear, piReady }: Props) {
  const router    = useRouter();
  const inFlight  = useRef(false);

  const [status,  setStatus]  = useState<CheckoutStatus>('idle');
  const [errMsg,  setErrMsg]  = useState('');

  const total     = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const itemCount = items.reduce((s, i) => s + i.qty, 0);

  const handleCheckout = async () => {
    if (inFlight.current || items.length === 0) return;

    // ADR-007: Hub navigation or Pi SDK not available → redirect to hub payment modal
    if (isHubNavigation() || !(window as any).Pi || !piReady) {
      redirectToHubPayment(total, itemCount);
      return;
    }

    inFlight.current = true;
    setStatus('creating');
    setErrMsg('');

    try {
      const memo       = `TEC Cart — ${itemCount} item${itemCount !== 1 ? 's' : ''}`;
      const internalId = await createPaymentRecord(total, 'cart_checkout', memo);

      if (!internalId) {
        setStatus('error');
        setErrMsg('Failed to initialize payment.');
        inFlight.current = false;
        return;
      }

      setStatus('paying');

      const cartItems = items.map(i => ({ productId: i.product.id, qty: i.qty }));
      const result    = await createU2APayment(
        total,
        memo,
        { source: 'cart', items: cartItems },
        internalId,
      );

      if (result.success) {
        await fetch('/api/bff/orders', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body:        JSON.stringify({ items: cartItems, payment_id: internalId, memo }),
        }).catch(() => {});

        setStatus('success');
        onClear();
        setTimeout(() => { setStatus('idle'); onClose(); router.push('/orders'); }, 1800);
      } else {
        setStatus(result.status === 'cancelled' ? 'cancelled' : 'error');
        setErrMsg(result.message ?? '');
      }
    } catch (err) {
      setStatus('error');
      setErrMsg(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      inFlight.current = false;
    }
  };

  const resetStatus = () => { setStatus('idle'); setErrMsg(''); };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 290, background: 'rgba(2,2,5,0.75)', backdropFilter: 'blur(6px)' }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 300,
        width: 320, maxWidth: '92vw',
        background: '#0a0a12',
        borderLeft: '1px solid rgba(212,175,55,0.1)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🛒</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#e8d5a3', fontFamily: 'Georgia,serif' }}>Cart</div>
              <div style={{ fontSize: 10, color: '#4a4a5a', fontFamily: 'system-ui' }}>
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {items.length > 0 && (
              <button onClick={onClear}
                style={{ fontFamily: 'system-ui', fontSize: 11, color: '#4a4a5a', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
                Clear all
              </button>
            )}
            <button onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: 'none', color: '#6b6b7a', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ×
            </button>
          </div>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 44, opacity: 0.2, marginBottom: 12 }}>🛒</div>
              <p style={{ fontFamily: 'system-ui', fontSize: 13, color: '#3a3a4a', marginBottom: 6 }}>Your cart is empty</p>
              <p style={{ fontFamily: 'system-ui', fontSize: 11, color: '#2a2a3a' }}>Add products from the shop</p>
            </div>
          ) : (
            items.map(({ product, qty }) => {
              const imgSrc = product.images?.[0] ?? product.image_url;
              const label  = product.title ?? 'Product';
              return (
                <div key={product.id} style={{ display: 'flex', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {/* Image */}
                  <div style={{ width: 54, height: 54, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#0d0d18', border: '1px solid rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {imgSrc
                      ? <img src={imgSrc} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 22, opacity: 0.25 }}>🛍</span>}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'system-ui', fontSize: 13, fontWeight: 600, color: '#d0d0e0', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                    <div style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 700, color: '#d4af37', marginBottom: 8 }}>
                      {(product.price * qty).toFixed(2)}π
                      {qty > 1 && <span style={{ fontFamily: 'system-ui', fontSize: 10, color: '#6b6b7a', marginLeft: 4 }}>({product.price}π each)</span>}
                    </div>

                    {/* Qty controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => onUpdateQty(product.id, qty - 1)}
                        style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#aaa', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                        −
                      </button>
                      <span style={{ fontFamily: 'system-ui', fontSize: 13, fontWeight: 700, color: '#fff', minWidth: 20, textAlign: 'center' }}>{qty}</span>
                      <button onClick={() => onUpdateQty(product.id, qty + 1)}
                        style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#aaa', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                        +
                      </button>
                      <button onClick={() => onRemove(product.id)}
                        style={{ marginLeft: 4, background: 'none', border: 'none', color: '#4a4a5a', cursor: 'pointer', fontSize: 14, padding: '2px 4px', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#4a4a5a')}>
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontFamily: 'system-ui', fontSize: 12, color: '#6b6b7a' }}>Total ({itemCount} items)</span>
              <span style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 900, color: '#d4af37' }}>{total.toFixed(2)}π</span>
            </div>

            {/* Status messages */}
            {status === 'creating' && (
              <div style={{ fontFamily: 'system-ui', fontSize: 12, color: '#f0c040', textAlign: 'center', marginBottom: 10 }}>Preparing payment…</div>
            )}
            {status === 'paying' && (
              <div style={{ fontFamily: 'system-ui', fontSize: 12, color: '#7ee7c0', textAlign: 'center', marginBottom: 10 }}>Complete payment in Pi wallet…</div>
            )}
            {status === 'success' && (
              <div style={{ fontFamily: 'system-ui', fontSize: 12, color: '#10b981', textAlign: 'center', marginBottom: 10 }}>🎉 Payment successful! Redirecting…</div>
            )}
            {(status === 'error' || status === 'cancelled') && (
              <div style={{ marginBottom: 10, textAlign: 'center' }}>
                <div style={{ fontFamily: 'system-ui', fontSize: 12, color: status === 'cancelled' ? '#a78bfa' : '#ef4444', marginBottom: 6 }}>
                  {status === 'cancelled' ? 'Payment cancelled' : (errMsg || 'Payment failed')}
                </div>
                <button onClick={resetStatus}
                  style={{ fontFamily: 'system-ui', fontSize: 11, color: '#6b6b7a', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}>
                  Try again
                </button>
              </div>
            )}

            {/* Checkout button */}
            <button
              onClick={handleCheckout}
              disabled={!piReady || status === 'creating' || status === 'paying' || status === 'success'}
              style={{
                width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                background: (!piReady || status !== 'idle')
                  ? '#1a1a28'
                  : 'linear-gradient(135deg,#d4af37,#b8882a)',
                color: (!piReady || status !== 'idle') ? '#3a3a4a' : '#07070f',
                fontFamily: 'system-ui', fontSize: 14, fontWeight: 800,
                cursor: (!piReady || status !== 'idle') ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s',
              }}>
              {status === 'creating' ? '⏳ Preparing…'
                : status === 'paying'   ? '🔷 Pay in Pi Wallet…'
                : status === 'success'  ? '✅ Done!'
                : piReady               ? '🔷 Checkout with Pi'
                : '⏳ Connecting…'}
            </button>

            <p style={{ fontFamily: 'system-ui', fontSize: 10, color: '#3a3a4a', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
              Secure payment via Pi Network
            </p>
          </div>
        )}

      </div>
    </>
  );
}
