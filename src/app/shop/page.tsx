'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter }                                   from 'next/navigation';
import { usePiAuth, getCsrfToken }                    from '@yasser172/tec-auth';
import { TEC_COLORS }                                  from '@yasser172/tec-ui';
import
import { Product, ProductFilters, SortOption }         from '../../types';
// ✅
const HUB_URL_PAY = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';

const handleBuy = (params: { amount: number; memo: string; productId: string; returnUrl: string; source: string }) => {
  window.location.href = `${HUB_URL_PAY}/hub?pay=1`
    + `&amount=${params.amount}`
    + `&memo=${encodeURIComponent(params.memo)}`
    + `&product_id=${encodeURIComponent(params.productId)}`
    + `&return_url=${encodeURIComponent(params.returnUrl)}`
    + `&source=${params.source}`;
};

const getPaymentReturnParams = () => {
  if (typeof window === 'undefined') return { status: null, txid: null, paymentId: null, productId: null };
  const params = new URLSearchParams(window.location.search);
  return { status: params.get('payment_status'), txid: params.get('txid'), paymentId: params.get('payment_id'), productId: params.get('product_id') };
};

const clearPaymentParams = () => window.history.replaceState({}, '', window.location.pathname);
const ECOMMERCE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';
const CATEGORIES = [
  { slug: 'all',        name: 'All',        emoji: '🛍️' },
  { slug: 'electronics',name: 'Electronics', emoji: '📱' },
  { slug: 'fashion',    name: 'Fashion',     emoji: '👗' },
  { slug: 'home',       name: 'Home',        emoji: '🏠' },
  { slug: 'food',       name: 'Food',        emoji: '🍕' },
  { slug: 'art',        name: 'Art',         emoji: '🎨' },
  { slug: 'services',   name: 'Services',    emoji: '⚙️' },
  { slug: 'other',      name: 'Other',       emoji: '📦' },
];

// ── Product Card ───────────────────────────────────────────
function ProductCard({ product, onBuy }: { product: Product; onBuy: (p: Product) => void }) {
  const [imgError, setImgError] = useState(false);
  const image = product.images?.[0];

  return (
    <div style={{ background: '#0d0d14', border: '1px solid #ffffff08', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Image */}
      <div style={{ width: '100%', aspectRatio: '1', background: '#ffffff05', position: 'relative', overflow: 'hidden' }}>
        {image && !imgError ? (
          <img src={image} alt={product.title}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
            🛍️
          </div>
        )}
        {/* Category badge */}
        <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '2px 8px', borderRadius: 20, backdropFilter: 'blur(4px)' }}>
          {product.category}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.title}
        </div>
        <div style={{ fontSize: 11, color: '#4a4a5a' }}>@{product.merchant_name}</div>

        {/* Rating */}
        {product.rating > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#f0c040' }}>★</span>
            <span style={{ fontSize: 10, color: '#6b6b7a' }}>{product.rating.toFixed(1)} ({product.reviews_count})</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: TEC_COLORS.gold }}>
            {product.price}π
          </div>
          <button onClick={() => onBuy(product)}
            style={{ padding: '7px 14px', background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`, border: 'none', borderRadius: 10, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Buy
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function ShopPage() {
  const { user, isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  const [products,     setProducts]     = useState<Product[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [category,     setCategory]     = useState('all');
  const [sort,         setSort]         = useState<SortOption>('newest');
  const [page,         setPage]         = useState(1);
  const [hasMore,      setHasMore]      = useState(true);
  const [toast,        setToast]        = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Handle payment return ────────────────────────────────
  useEffect(() => {
    const { status, paymentId, productId } = getPaymentReturnParams();
    if (status === 'success' && paymentId) {
      showToast('Purchase successful! 🎉');
      // Create order record
      if (productId) {
        fetch('/api/bff/orders', {
          method:  'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body:    JSON.stringify({ product_id: productId, payment_id: paymentId }),
        }).catch(() => {});
      }
      clearPaymentParams();
    } else if (status === 'cancelled') {
      showToast('Payment cancelled', 'error');
      clearPaymentParams();
    }
  }, [showToast]);

  // ── Fetch products ───────────────────────────────────────
  const fetchProducts = useCallback(async (filters: ProductFilters, reset = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search)   params.set('search',   filters.search);
      if (filters.category && filters.category !== 'all') params.set('category', filters.category);
      if (filters.sort)     params.set('sort',     filters.sort);
      if (filters.page)     params.set('page',     String(filters.page));
      params.set('limit', '12');

      const res = await fetch(`/api/bff/products?${params}`, { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const newProducts = data?.data?.products ?? data?.products ?? [];
        setProducts(prev => reset ? newProducts : [...prev, ...newProducts]);
        setHasMore(newProducts.length === 12);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchProducts({ search, category, sort, page: 1 }, true);
  }, [search, category, sort, fetchProducts]);

  // ── Handle buy ───────────────────────────────────────────
  const handleBuyProduct = useCallback((product: Product) => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    handleBuy({
      amount:    product.price,
      memo:      `Buy ${product.title} — TEC Ecommerce`,
      productId: product.id,
      returnUrl: `${ECOMMERCE_URL}/shop`,
      source:    'ecommerce',
    });
  }, [isAuthenticated, router]);

  // ── Load more ────────────────────────────────────────────
  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProducts({ search, category, sort, page: nextPage });
  }, [page, search, category, sort, fetchProducts]);

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0d0d14',
    border: '1px solid #ffffff10', borderRadius: 12,
    padding: '11px 16px 11px 40px', color: '#fff',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020205', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif', paddingBottom: 32 }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: 16, right: 16, zIndex: 999, background: toast.type === 'success' ? '#051a0a' : '#1a0505', border: `1px solid ${toast.type === 'success' ? '#7ee7c040' : '#e74c3c40'}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, animation: 'slideDown 0.3s ease' }}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: toast.type === 'success' ? '#7ee7c0' : '#e74c3c' }}>{toast.msg}</span>
        </div>
      )}

      <style>{`
        @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:none} }
        ::-webkit-scrollbar { display: none; }
        input::placeholder { color: #3a3a4a; }
      `}</style>

      {/* Header */}
      <header style={{ padding: '14px 16px', borderBottom: '1px solid #ffffff06', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(2,2,5,0.95)', backdropFilter: 'blur(20px)', zIndex: 100 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: TEC_COLORS.gold }}>🛍️ TEC Store</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user && <span style={{ fontSize: 12, color: '#4a4a5a' }}>@{user.piUsername}</span>}
          <button onClick={() => router.push('/orders')}
            style={{ padding: '6px 12px', background: '#ffffff08', border: '1px solid #ffffff10', borderRadius: 10, color: '#6b6b7a', fontSize: 12, cursor: 'pointer' }}>
            🧾 Orders
          </button>
        </div>
      </header>

      <div style={{ padding: '16px 16px 0' }}>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#3a3a4a' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            style={inputStyle} />
        </div>

        {/* Categories */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 8 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.slug} onClick={() => setCategory(cat.slug)}
              style={{ padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: category === cat.slug ? 'rgba(212,175,55,0.12)' : '#ffffff06', color: category === cat.slug ? TEC_COLORS.gold : '#4a4a5a', border: category === cat.slug ? `1px solid rgba(212,175,55,0.3)` : '1px solid transparent', transition: 'all 0.2s' }}>
              {cat.emoji} {cat.name}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {([
            { key: 'newest',     label: '🕐 Newest'    },
            { key: 'price_asc',  label: '↑ Price'     },
            { key: 'price_desc', label: '↓ Price'     },
            { key: 'rating',     label: '⭐ Rating'    },
          ] as { key: SortOption; label: string }[]).map(s => (
            <button key={s.key} onClick={() => setSort(s.key)}
              style={{ padding: '5px 12px', borderRadius: 20, whiteSpace: 'nowrap', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: sort === s.key ? '#ffffff12' : 'transparent', color: sort === s.key ? '#fff' : '#4a4a5a', border: sort === s.key ? '1px solid #ffffff20' : '1px solid transparent', transition: 'all 0.2s' }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {loading && products.length === 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ background: '#0d0d14', borderRadius: 16, overflow: 'hidden', animation: 'pulse 1.4s ease infinite' }}>
                <div style={{ aspectRatio: '1', background: '#ffffff06' }} />
                <div style={{ padding: 12 }}>
                  <div style={{ height: 14, background: '#ffffff06', borderRadius: 6, marginBottom: 8, width: '70%' }} />
                  <div style={{ height: 10, background: '#ffffff04', borderRadius: 4, width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, color: '#4a4a5a' }}>No products found</div>
            <div style={{ fontSize: 12, color: '#2a2a3a', marginTop: 6 }}>Try a different search or category</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {products.map(product => (
                <ProductCard key={product.id} product={product} onBuy={handleBuyProduct} />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button onClick={loadMore} disabled={loading}
                  style={{ padding: '12px 32px', background: '#ffffff08', border: '1px solid #ffffff10', borderRadius: 14, color: '#6b6b7a', fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? '...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
      }
