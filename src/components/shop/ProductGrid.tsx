'use client';
import { ProductCard } from './ProductCard';

interface Product {
  id: string; title: string; name?: string;
  description: string; price: number;
  images?: string[]; image_url?: string;
  seller_id?: string; merchant_name?: string;
}
interface Props {
  products:      Product[];
  piReady:       boolean;
  onBuy:         (p: Product) => void;
  onAddToCart?:  (p: Product) => void;
}

export function ProductGrid({ products, piReady, onBuy, onAddToCart }: Props) {
  if (products.length === 0) return (
    <div style={{ textAlign:'center', padding:'80px 0' }}>
      <div style={{ fontSize:48, marginBottom:12, opacity:0.4 }}>📦</div>
      <p style={{ fontFamily:'system-ui,sans-serif', fontSize:14, color:'#3a3a4a' }}>No products yet</p>
    </div>
  );

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} piReady={piReady} onBuy={onBuy} onAddToCart={onAddToCart} delay={i * 60} />
      ))}
    </div>
  );
}
