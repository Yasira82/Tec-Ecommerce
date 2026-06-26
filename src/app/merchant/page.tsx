'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter }   from 'next/navigation';
import { usePiAuth }   from '@yasser172/tec-auth';
import { ShopHeader }  from '@/components/shop/ShopHeader';
import { EcommerceDrawer } from '@/components/shop/EcommerceDrawer';
import { CartDrawer }  from '@/components/shop/CartDrawer';
import { useCart }     from '@/lib-client/cart/useCart';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';

interface Product {
  id: string; title: string; name?: string;
  description: string; price: number;
  images?: string[]; image_url?: string;
  category?: string; stock?: number;
  rating?: number; reviews_count?: number;
}

const getStoredUser = () => {
  try {
    const raw = document.cookie.split('; ').find(r => r.startsWith('tec_user='))?.split('=')?.[1] ?? '';
    return raw ? JSON.parse(decodeURIComponent(raw)) : null;
  } catch { return null; }
};

function StatCard({ label, value, color = '#e8d5a3', sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{
      background: '#111627', border: '1px solid rgba(251,191,36,0.1)',
      borderRadius: 16, padding: '20px 18px',
    }}>
      <div style={{ fontSize: 10, color: '#4a4a5a', fontFamily: 'system-ui', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#4a4a5a', fontFamily: 'system-ui', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

export default function MerchantPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = usePiAuth();

  const [products,   setProducts]   = useState<Product[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [username,   setUsername]   = useState<string | null>(null);
  const [piReady,    setPiReady]    = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartOpen,   setCartOpen]   = useState(false);
  const { items: cartItems, itemCount, removeFromCart, updateQty, clearCart } = useCart();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__TEC_PI_READY) { setPiReady(true); return; }
    const h = () => setPiReady(true);
    window.addEventListener('tec-pi-ready', h, { once: true });
    return () => window.removeEventListener('tec-pi-ready', h);
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = `${HUB_URL}/api/auth/sso?target=${encodeURIComponent(APP_URL + '/merchant')}`;
    }
    if (isAuthenticated) {
      const user = getStoredUser();
      if (user?.piUsername) setUsername(user.piUsername);
    }
  }, [isAuthenticated, authLoading]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/bff/merchant/products', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setProducts(data?.data?.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  // Derived stats
  const inStock    = products.filter(p => (p.stock ?? 1) > 0).length;
  const outOfStock = products.filter(p => p.stock === 0).length;
  const totalValue = products.reduce((sum, p) => sum + p.price, 0);
  const categories = new Set(products.map(p => p.category).filter(Boolean));

  if (authLoading || (loading && products.length === 0)) return (
    <div style={{ minHeight: '100vh', background: '#050816', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(251,191,36,0.15)', borderTopColor: '#FBBF24', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#050816', color: '#fff', fontFamily: 'Georgia, serif' }}>

      <EcommerceDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} username={username ?? undefined} hubUrl={HUB_URL} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} items={cartItems} onUpdateQty={updateQty} onRemove={removeFromCart} onClear={clearCart} piReady={piReady} />
      <ShopHeader piReady={piReady} onMenuOpen={() => setDrawerOpen(true)} cartCount={itemCount} onCartOpen={() => setCartOpen(true)} />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px 60px' }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 0 22px', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#e8d5a3', margin: 0, letterSpacing: '-0.01em' }}>My Store</h1>
            {username && (
              <p style={{ fontFamily: 'system-ui', fontSize: 13, color: '#4a4a5a', margin: '4px 0 0' }}>@{username}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={load}
              disabled={loading}
              style={{ padding: '8px 16px', borderRadius: 12, border: '1px solid rgba(251,191,36,0.2)', background: 'transparent', color: loading ? '#3a3a4a' : '#FBBF24', fontFamily: 'system-ui', fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? '⟳' : '↻ Refresh'}
            </button>
            <button
              onClick={() => router.push('/shop')}
              style={{ padding: '8px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#6b6b7a', fontFamily: 'system-ui', fontSize: 12, cursor: 'pointer' }}
            >
              ← Shop
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 28 }}>
          <StatCard label="Products"        value={products.length}                  color="#e8d5a3" />
          <StatCard label="In Stock"         value={inStock}                          color="#10b981" />
          <StatCard label="Out of Stock"     value={outOfStock}                       color="#ef4444" />
          <StatCard label="Catalogue Value"  value={`${totalValue.toFixed(0)}π`}     color="#FBBF24" sub={`${categories.size} categor${categories.size === 1 ? 'y' : 'ies'}`} />
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', color: '#ef4444', fontFamily: 'system-ui', fontSize: 13, marginBottom: 20 }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Product table ── */}
        <div style={{ background: '#111627', border: '1px solid rgba(251,191,36,0.1)', borderRadius: 18, overflow: 'hidden' }}>

          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(251,191,36,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e8d5a3' }}>Products</div>
              <div style={{ fontFamily: 'system-ui', fontSize: 11, color: '#4a4a5a', marginTop: 2 }}>
                {loading ? 'Loading…' : `${products.length} product${products.length !== 1 ? 's' : ''} listed`}
              </div>
            </div>
          </div>

          {products.length === 0 && !loading ? (
            <div style={{ padding: '52px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 42, marginBottom: 14, opacity: 0.25 }}>🏪</div>
              <p style={{ fontFamily: 'system-ui', fontSize: 14, color: '#4a4a5a', marginBottom: 16 }}>No products listed yet</p>
              <p style={{ fontFamily: 'system-ui', fontSize: 12, color: '#3a3a4a' }}>Products you list on TEC Commerce will appear here</p>
            </div>
          ) : (
            products.map((p, i) => {
              const imgSrc  = p.images?.[0] ?? p.image_url;
              const label   = p.title ?? p.name ?? 'Product';
              const hasStock = (p.stock ?? 1) > 0;
              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/product/${p.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 20px',
                    borderBottom: i < products.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Thumbnail */}
                  <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#141428', border: '1px solid rgba(251,191,36,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {imgSrc
                      ? <img
                          src={imgSrc}
                          alt={label}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      : <span style={{ fontSize: 20, opacity: 0.3 }}>🛍</span>
                    }
                  </div>

                  {/* Name + category */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e8d5a3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                    <div style={{ fontFamily: 'system-ui', fontSize: 11, color: '#4a4a5a', marginTop: 2 }}>{p.category ?? '—'}</div>
                  </div>

                  {/* Price */}
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#FBBF24', fontFamily: 'Georgia', flexShrink: 0 }}>{p.price}π</div>

                  {/* Stock badge */}
                  <div style={{
                    fontFamily: 'system-ui', fontSize: 10, fontWeight: 700,
                    padding: '3px 10px', borderRadius: 20, flexShrink: 0,
                    background: hasStock ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color:      hasStock ? '#10b981'              : '#ef4444',
                    border:     `1px solid ${hasStock ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  }}>
                    {hasStock ? `✓ ${p.stock ?? '—'}` : '✕ Out'}
                  </div>

                  {/* Rating */}
                  {(p.rating ?? 0) > 0 && (
                    <div style={{ fontFamily: 'system-ui', fontSize: 11, color: '#FBBF24', flexShrink: 0 }}>★ {p.rating!.toFixed(1)}</div>
                  )}

                  <div style={{ fontSize: 13, color: '#3a3a4a', flexShrink: 0 }}>›</div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
