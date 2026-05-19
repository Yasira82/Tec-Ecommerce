'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter }                         from 'next/navigation';
import { usePiAuth }                         from '@yasser172/tec-auth';
import { TEC_COLORS }                        from '@yasser172/tec-ui';
import { Product, Category, ProductFilters, SortOption } from '../../types';

const ECOMMERCE_URL = process.env.NEXT_PUBLIC_APP_URL  ?? 'https://ecommerce.tecosystem.app';
const HUB_URL       = process.env.NEXT_PUBLIC_HUB_URL  ?? 'https://hub.tecosystem.app';

const formatPi = (amount: number, decimals = 2) =>
  `${Number(amount).toFixed(decimals)}π`;

// ── Product Card ──────────────────────────────────────────
function ProductCard({ product, onBuy, onView }: {
  product: Product;
  onBuy:  (p: Product) => void;
  onView: (p: Product) => void;
}) {
  const [imgError, setImgError] = useState(false);
  return (
    <div onClick={() => onView(product)}
      style={{ background: '#0d0d14', border: '1px solid #ffffff08', borderRadius: 16, overflow: 'hidden', cursor: 'pointer' }}>
      <div style={{ width: '100%', aspectRatio: '1', background: '#ffffff05', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {product.images?.[0] && !imgError ? (
          <img src={product.images[0]} alt={product.title} onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 32 }}>🛍️</span>
        )}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.title}
        </div>
        <div style={{ fontSize: 10, color: '#4a4a5a', marginBottom: 8 }}>@{product.merchant_name}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: TEC_COLORS.gold }}>{formatPi(product.price)}</span>
          <button onClick={e => { e.stopPropagation(); onBuy(product); }}
            style={{ padding: '5px 12px', background: `linear-gradient(135deg,${TEC_COLORS.gold},${TEC_COLORS.goldDark})`, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Buy
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function ShopPage() {
  const { isAuthenticated, isLoading: authLoading } = usePiAuth();
  const router = useRouter();

  const [products,    setProducts]    = useState<Product[]>([]);
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filters,     setFilters]     = useState<ProductFilters>({ sort: 'newest', page: 1, limit: 12 });
  const [search,      setSearch]      = useState('');

  // ✅ Bootstrap guard
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      window.location.href = `${HUB_URL}/auth/bootstrap?return_url=${encodeURIComponent(ECOMMERCE_URL + '/shop')}`;
    }
  }, [isAuthenticated, authLoading]);

  // ── Fetch products ────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.category && filters.category !== 'all') params.set('category', filters.category);
      if (filters.sort)  params.set('sort',  filters.sort);
      if (filters.page)  params.set('page',  String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (search)        params.set('search', search);

      const res  = await fetch(`/api/bff/products?${params}`, { credentials: 'include', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const list: Product[] = data?.data?.products ?? data?.products ?? [];
      setProducts(list);

      const cats: Category[] = Array.from(
        new Map(list.map(p => [p.category_slug, { id: p.category_slug, name: p.category, slug: p.category_slug, emoji: '🏷️', count: 0 }])).values()
      );
      setCategories(cats);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [filters, search, isAuthenticated]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // ── Payment return handler ────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p      = new URLSearchParams(window.location.search);
    const status = p.get('payment_status');
    if (status === 'success') {
      const paymentId = p.get('payment_id') ?? '';
      const productId = p.get('product_id') ?? '';
      if (paymentId && productId) {
        fetch('/api/bff/orders', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ product_id: productId, payment_id: paymentId }),
        }).catch(() => {});
      }
      window.history.replaceState({}, '', '/shop');
    }
  }, []);

  const handleBuy = useCallback((product: Product) => {
    const token = document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1];
    if (!token) {
      window.location.href = `${HUB_URL}/auth/bootstrap?return_url=${encodeURIComponent(ECOMMERCE_URL + '/shop')}`;
      return;
    }
    window.location.href = `${HUB_URL}/hub?pay=1`
      + `&amount=${product.price}`
      + `&memo=${encodeURIComponent(`Buy ${product.title} — TEC Ecommerce`)}`
      + `&product_id=${encodeURIComponent(product.id)}`
      + `&return_url=${encodeURIComponent(ECOMMERCE_URL + '/shop')}`
      + `&source=ecommerce`;
  }, []);

  const handleView = useCallback((product: Product) => {
    router.push(`/product/${product.id}`);
  }, [router]);

  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: '#020205', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(212,175,55,0.15)', borderTopColor: TEC_COLORS.gold, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#020205', color: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,system-ui,sans-serif', paddingBottom: 32 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} ::-webkit-scrollbar{display:none}`}</style>

      {/* Header */}
      <header style={{ padding: '14px 16px', position: 'sticky', top: 0, background: 'rgba(2,2,5,0.95)', backdropFilter: 'blur(20px)', zIndex: 100, borderBottom: '1px solid #ffffff06' }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: TEC_COLORS.gold, marginBottom: 10 }}>🏬 TEC Store</div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchProducts()}
          placeholder="Search products..."
          style={{ width: '100%', padding: '8px 12px', background: '#ffffff08', border: '1px solid #ffffff10', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
      </header>

      {/* Categories */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto' }}>
          {[{ id: 'all', name: 'All', slug: 'all', emoji: '✨', count: 0 }, ...categories].map(cat => (
            <button key={cat.slug} onClick={() => setFilters(f => ({ ...f, category: cat.slug, page: 1 }))}
              style={{ padding: '5px 14px', borderRadius: 20, border: 'none', background: filters.category === cat.slug ? TEC_COLORS.gold : '#ffffff10', color: filters.category === cat.slug ? '#0a0800' : '#6b6b7a', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {cat.emoji} {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Sort */}
      <div style={{ padding: '0 16px 10px', display: 'flex', gap: 8 }}>
        {(['newest', 'price_asc', 'price_desc', 'rating'] as SortOption[]).map(s => (
          <button key={s} onClick={() => setFilters(f => ({ ...f, sort: s, page: 1 }))}
            style={{ padding: '4px 12px', borderRadius: 16, border: 'none', background: filters.sort === s ? '#ffffff15' : 'transparent', color: filters.sort === s ? '#fff' : '#4a4a5a', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {s === 'newest' ? '🕐 New' : s === 'price_asc' ? '↑ Price' : s === 'price_desc' ? '↓ Price' : '⭐ Rating'}
          </button>
        ))}
      </div>

      {/* Products */}
      <div style={{ padding: '0 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(212,175,55,0.15)', borderTopColor: TEC_COLORS.gold, animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: 14, color: '#4a4a5a' }}>No products found</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {products.map(p => (
              <ProductCard key={p.id} product={p} onBuy={handleBuy} onView={handleView} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {products.length === filters.limit && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '20px 16px' }}>
          {(filters.page ?? 1) > 1 && (
            <button onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
              style={{ padding: '8px 20px', background: '#ffffff10', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, cursor: 'pointer' }}>← Prev</button>
          )}
          <button onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
            style={{ padding: '8px 20px', background: '#ffffff10', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, cursor: 'pointer' }}>Next →</button>
        </div>
      )}
    </div>
  );
                                                    }
