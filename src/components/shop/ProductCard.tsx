'use client';

interface Product {
  id: string; title: string; name?: string;
  description: string; price: number;
  images?: string[]; image_url?: string;
  category?: string; rating?: number; reviews_count?: number;
}

export function ProductCard({ product, onBuy, delay = 0 }: {
  product: Product; onBuy: (p: Product) => void; delay?: number;
}) {
  const imgSrc = product.images?.[0] ?? product.image_url;
  const label  = product.title ?? product.name ?? 'Product';

  return (
    <article onClick={() => onBuy(product)} style={{
      display: 'flex', gap: 12, padding: 12,
      background: '#0b0b16', borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.04)',
      cursor: 'pointer', transition: 'all 0.2s',
      animation: `fadeUp 0.3s ease ${delay}ms both`,
    }}>
      {/* Image */}
      <div style={{
        width: 72, height: 72, borderRadius: 14, overflow: 'hidden',
        background: '#0d0d18', flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        {imgSrc
          ? <img src={imgSrc} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{
              width: '100%', height: '100%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 28, opacity: 0.2,
            }}>🛍</div>
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h3 style={{
            fontSize: 13, fontWeight: 700, color: '#e8d5a3',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontFamily: 'Georgia,serif', margin: 0,
          }}>{label}</h3>
          <span style={{
            fontSize: 14, fontWeight: 900, color: '#d4af37',
            fontFamily: 'Georgia,serif', flexShrink: 0,
          }}>{product.price}π</span>
        </div>

        <p style={{
          fontSize: 11, color: '#4a4a5a', lineHeight: 1.4, margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{product.description}</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {product.category && (
            <span style={{
              fontSize: 8, color: '#6b6b7a', letterSpacing: 1.5,
              textTransform: 'uppercase', fontWeight: 700,
            }}>{product.category}</span>
          )}
          {product.rating ? (
            <span style={{ fontSize: 10, color: '#d4af37' }}>
              {'★'.repeat(Math.round(product.rating))}
              <span style={{ color: '#2a2a3a' }}>{'☆'.repeat(5 - Math.round(product.rating))}</span>
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Grid card for featured section */
export function ProductGridCard({ product, onBuy, delay = 0 }: {
  product: Product; onBuy: (p: Product) => void; delay?: number;
}) {
  const imgSrc = product.images?.[0] ?? product.image_url;
  const label  = product.title ?? product.name ?? 'Product';

  return (
    <article onClick={() => onBuy(product)} style={{
      borderRadius: 18, overflow: 'hidden',
      background: '#0b0b16', border: '1px solid rgba(255,255,255,0.04)',
      cursor: 'pointer', transition: 'all 0.2s',
      animation: `fadeUp 0.35s ease ${delay}ms both`,
    }}>
      <div style={{ height: 120, position: 'relative', overflow: 'hidden', background: '#0d0d18' }}>
        {imgSrc
          ? <img src={imgSrc} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{
              height: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 36, opacity: 0.15,
            }}>🛍</div>
        }
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          background: 'rgba(7,7,15,0.9)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(212,175,55,0.3)', color: '#d4af37',
          fontSize: 12, fontWeight: 900, fontFamily: 'Georgia,serif',
          padding: '3px 10px', borderRadius: 16,
        }}>{product.price}π</div>
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <h3 style={{
          fontSize: 12, fontWeight: 700, color: '#e8d5a3',
          marginBottom: 2, fontFamily: 'Georgia,serif',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{label}</h3>
        <p style={{
          fontSize: 10, color: '#4a4a5a', lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{product.description}</p>
      </div>
    </article>
  );
}
