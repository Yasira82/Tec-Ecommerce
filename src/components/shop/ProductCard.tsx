'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Product {
  id: string; title: string; name?: string;
  description: string; price: number;
  images?: string[]; image_url?: string;
  seller_id?: string; merchant_name?: string;
}

interface Props {
  product:       Product;
  piReady:       boolean;
  onBuy:         (p: Product) => void;
  onAddToCart?:  (p: Product) => void;
  onCartOpen?:   () => void;
  delay?:        number;
}

export function ProductCard({ product, piReady, onBuy, onAddToCart, onCartOpen, delay = 0 }: Props) {
  const [added,  setAdded]  = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const router   = useRouter();
  const imgSrc   = product.images?.[0] ?? product.image_url;
  const label    = product.title ?? product.name ?? 'Product';
  const sellerId = product.seller_id ?? product.merchant_name;
  const sellerName = product.merchant_name || product.seller_id;

  const handleAdd = () => {
    onAddToCart?.(product);
    onCartOpen?.();
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  return (
    <article style={{
      borderRadius: 14, overflow: 'hidden',
      background: '#0d0d18', border: '1px solid rgba(212,175,55,0.1)',
      animation: `fadeUp 0.4s ease ${delay}ms both`,
      transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
    }}>
      <div style={{ position: 'relative' }}>
        {imgSrc && !imgErr
          ? <img
              src={imgSrc}
              alt={label}
              style={{ width:'100%', height:110, objectFit:'cover', display:'block' }}
              onError={() => setImgErr(true)}
            />
          : <div style={{ width:'100%', height:110, background:'linear-gradient(135deg,#0d0d18,#141428)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, opacity:0.3 }}>🛍</div>
        }
        <div style={{ position:'absolute', top:8, right:8, background:'rgba(7,7,15,0.88)', border:'1px solid rgba(212,175,55,0.4)', color:'#d4af37', fontSize:11, fontWeight:900, padding:'2px 8px', borderRadius:20, fontFamily:'Georgia', backdropFilter:'blur(8px)' }}>
          {product.price}π
        </div>
      </div>
      <div style={{ padding: 10 }}>
        <h3 style={{ fontSize:12, fontWeight:700, color:'#e8d5a3', lineHeight:1.3, marginBottom:2 }}>{label}</h3>
        {sellerName && (
          <button
            onClick={e => { e.stopPropagation(); if (sellerId) router.push(`/store/${sellerId}`); }}
            style={{ background:'none', border:'none', padding:0, cursor:'pointer', fontSize:10, color:'rgba(212,175,55,0.7)', fontFamily:'system-ui', marginBottom:4, display:'flex', alignItems:'center', gap:3, lineHeight:1.3 }}
          >
            🏪 <span style={{ textDecoration:'underline', textDecorationColor:'rgba(212,175,55,0.3)' }}>{sellerName}</span>
          </button>
        )}
        <p style={{ fontFamily:'system-ui', fontSize:10, color:'#4a4a5a', lineHeight:1.5, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {product.description}
        </p>
        {onAddToCart ? (
          <div style={{ display:'flex', gap:5 }}>
            <button
              onClick={handleAdd}
              style={{
                flex:1, padding:'7px 4px', borderRadius:10,
                border: added ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(212,175,55,0.35)',
                background: added ? 'rgba(16,185,129,0.12)' : 'rgba(212,175,55,0.08)',
                color: added ? '#10b981' : '#d4af37',
                fontSize:11, fontWeight:700, fontFamily:'system-ui', cursor:'pointer', transition:'all 0.2s',
              }}
            >
              {added ? '✓ Added' : '+ Cart'}
            </button>
            <button
              onClick={() => piReady && onBuy(product)}
              disabled={!piReady}
              style={{
                flex:1, padding:'7px 4px', borderRadius:10, border:'none',
                background: piReady ? 'linear-gradient(135deg,#d4af37,#b8882a)' : '#1a1a28',
                color: piReady ? '#07070f' : '#3a3a4a',
                fontSize:11, fontWeight:800, fontFamily:'system-ui',
                cursor: piReady ? 'pointer' : 'not-allowed',
              }}
            >
              {piReady ? '⚡ Buy' : '···'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => onBuy(product)}
            disabled={!piReady}
            style={{
              width:'100%', padding:'7px 4px', borderRadius:10, border:'none',
              background: piReady ? 'linear-gradient(135deg,#d4af37,#b8882a)' : '#1a1a28',
              color: piReady ? '#07070f' : '#3a3a4a',
              fontSize:11, fontWeight:800, fontFamily:'system-ui',
              cursor: piReady ? 'pointer' : 'not-allowed',
            }}
          >
            {piReady ? 'Buy Now' : 'Connecting...'}
          </button>
        )}
      </div>
    </article>
  );
}
