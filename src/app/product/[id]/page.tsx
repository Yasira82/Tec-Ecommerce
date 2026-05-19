'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams }              from 'next/navigation';
import { usePiAuth }                         from '@yasser172/tec-auth';
import { TEC_COLORS }                        from '@yasser172/tec-ui';
import { Product }                           from '../../../types';

const ECOMMERCE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';
const HUB_URL       = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';

const formatPi = (amount: number, decimals = 2) =>
  `${Number(amount).toFixed(decimals)}π`;

export default function ProductDetailPage() {
  const { isAuthenticated, isLoading: authLoading } = usePiAuth();
  const router = useRouter();
  const params = useParams();
  const id     = params?.id as string;

  const [product,  setProduct]  = useState<Product | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [imgIndex, setImgIndex] = useState(0);
  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ✅ Bootstrap guard
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      window.location.href = `${HUB_URL}/auth/bootstrap?return_url=${encodeURIComponent(`${ECOMMERCE_URL}/product/${id}`)}`;
    }
  }, [isAuthenticated, authLoading, id]);

  // ── Payment return ────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p         = new URLSearchParams(window.location.search);
    const status    = p.get('payment_status');
    const paymentId = p.get('payment_id');
    const productId = p.get('product_id');
    if (status === 'success' && paymentId) {
      showToast('Purchase successful! 🎉');
      if (productId) {
        fetch('/api/bff/orders', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ product_id: productId, payment_id: paymentId }),
        }).catch(() => {});
      }
      window.history.replaceState({}, '', `/product/${id}`);
    } else if (status === 'cancelled') {
      showToast('Payment cancelled', 'error');
      window.history.replaceState({}, '', `/product/${id}`);
    }
  }, [id, showToast]);

  // ── Fetch product ─────────────────────────────────────
  useEffect(() => {
    if (!id || !isAuthenticated) return;
    setLoading(true);
    fetch(`/api/bff/products/${id}`, { credentials: 'include', cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => setProduct(data?.product ?? data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, isAuthenticated]);

  const handleBuy = useCallback(() => {
    if (!product) return;
    const token = document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1];
    if (!token) {
      window.location.href = `${HUB_URL}/auth/bootstrap?return_url=${encodeURIComponent(`${ECOMMERCE_URL}/product/${id}`)}`;
      return;
    }
    window.location.href = `${HUB_URL}/hub?pay=1`
      + `&amount=${product.price}`
      + `&memo=${encodeURIComponent(`Buy ${product.title} — TEC Ecommerce`)}`
      + `&product_id=${encodeURIComponent(product.id)}`
      + `&return_url=${encodeURIComponent(`${ECOMMERCE_URL}/product/${id}`)}`
      + `&source=ecommerce`;
  }, [product, id]);

  if (authLoading || loading) return (
    <div style={{ minHeight: '100vh', background: '#020205', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(212,175,55,0.15)', borderTopColor: TEC_COLORS.gold, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!product) return (
    <div style={{ minHeight: '100vh', background: '#020205', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ fontSize: 48 }}>🔍</div>
      <div style={{ fontSize: 15, color: '#4a4a5a' }}>Product not found</div>
      <button onClick={() => router.push('/shop')}
        style={{ padding: '10px 24px', background: TEC_COLORS.gold, border: 'none', borderRadius: 12, color: '#0a0800', fontWeight: 700, cursor: 'pointer' }}>
        Back to Shop
      </button>
    </div>
  );

  const images = product.images?.length ? product.images : [];

  return (
    <div style={{ minHeight: '100vh', background: '#020205', color: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,system-ui,sans-serif', paddingBottom: 100 }}>

      {toast && (
        <div style={{ position: 'fixed', top: 16, left: 16, right: 16, zIndex: 999, background: toast.type === 'success' ? '#051a0a' : '#1a0505', border: `1px solid ${toast.type === 'success' ? '#7ee7c040' : '#e74c3c40'}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: toast.type === 'success' ? '#7ee7c0' : '#e74c3c' }}>{toast.msg}</span>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} ::-webkit-scrollbar{display:none}`}</style>

      {/* Header */}
      <header style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: 'rgba(2,2,5,0.95)', backdropFilter: 'blur(20px)', zIndex: 100, borderBottom: '1px solid #ffffff06' }}>
        <button onClick={() => router.push('/shop')}
          style={{ background: '#ffffff08', border: '1px solid #ffffff10', borderRadius: 10, padding: '6px 12px', color: '#6b6b7a', fontSize: 14, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</div>
      </header>

      {/* Image Gallery */}
      <div style={{ background: '#0a0a10' }}>
        <div style={{ width: '100%', aspectRatio: '1', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {images.length > 0 ? (
            <img src={images[imgIndex]} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ fontSize: 64 }}>🛍️</div>
          )}
        </div>
        {images.length > 1 && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto' }}>
            {images.map((img, i) => (
              <div key={i} onClick={() => setImgIndex(i)}
                style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: `2px solid ${i === imgIndex ? TEC_COLORS.gold : 'transparent'}`, cursor: 'pointer', opacity: i === imgIndex ? 1 : 0.5 }}>
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#4a4a5a', background: '#ffffff06', padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 1 }}>{product.category}</span>
          {product.rating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#f0c040' }}>★</span>
              <span style={{ fontSize: 12, color: '#6b6b7a' }}>{product.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 8px', lineHeight: 1.2 }}>{product.title}</h1>
        <button onClick={() => router.push(`/store/${product.merchant_id}`)}
          style={{ fontSize: 13, color: TEC_COLORS.gold, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginBottom: 16, padding: 0 }}>
          @{product.merchant_name}
        </button>
        <div style={{ fontSize: 14, color: '#8b8b9a', lineHeight: 1.6, marginBottom: 20 }}>{product.description}</div>

        {product.stock <= 5 && product.stock > 0 && (
          <div style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '6px 12px', marginBottom: 16, display: 'inline-block' }}>
            ⚠️ Only {product.stock} left
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          {[{ label: 'Price', value: formatPi(product.price) }, { label: 'Stock', value: `${product.stock}` }, { label: 'Reviews', value: `${product.reviews_count}` }].map(s => (
            <div key={s.label} style={{ background: '#0d0d14', borderRadius: 12, padding: '10px 12px', textAlign: 'center', border: '1px solid #ffffff06' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: TEC_COLORS.gold }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#4a4a5a', marginTop: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Buy Button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', background: 'rgba(2,2,5,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid #ffffff08' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#4a4a5a', letterSpacing: 1, textTransform: 'uppercase' }}>Price</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: TEC_COLORS.gold }}>{formatPi(product.price)}</div>
          </div>
          <button onClick={handleBuy} disabled={product.stock === 0}
            style={{ flex: 1, padding: '14px', background: product.stock === 0 ? '#ffffff10' : `linear-gradient(135deg,${TEC_COLORS.gold},${TEC_COLORS.goldDark})`, border: 'none', borderRadius: 16, color: product.stock === 0 ? '#4a4a5a' : '#0a0800', fontSize: 16, fontWeight: 800, cursor: product.stock === 0 ? 'not-allowed' : 'pointer' }}>
            {product.stock === 0 ? 'Out of Stock' : '🛍️ Buy Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
