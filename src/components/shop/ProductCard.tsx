'use client';
interface Product {
  id: string; title: string; name?: string;
  description: string; price: number;
  images?: string[]; image_url?: string;
}
interface Props { product: Product; piReady: boolean; onBuy: (p: Product) => void; delay?: number }

export function ProductCard({ product, piReady, onBuy, delay = 0 }: Props) {
  const imgSrc = product.images?.[0] ?? product.image_url;
  const label  = product.title ?? product.name ?? 'Product';

  return (
    <article
      onClick={() => piReady && onBuy(product)}
      style={{
        borderRadius:20, background:'#0d0d18', border:'1px solid rgba(212,175,55,0.12)',
        overflow:'hidden', cursor: piReady ? 'pointer' : 'default',
        transition:'transform 0.2s,border-color 0.2s,box-shadow 0.2s',
        animation:`fadeUp 0.4s ease ${delay}ms both`,
      }}
      onMouseEnter={e => {
        if (!piReady) return;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,175,55,0.35)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(212,175,55,0.08)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = '';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,175,55,0.12)';
        (e.currentTarget as HTMLElement).style.boxShadow = '';
      }}
    >
      <div style={{ position:'relative' }}>
        {imgSrc
          ? <img src={imgSrc} alt={label} style={{ width:'100%', height:150, objectFit:'cover', display:'block' }} />
          : <div style={{ width:'100%', height:150, background:'linear-gradient(135deg,#0d0d18,#141420)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, opacity:0.4 }}>🛍</div>
        }
        <div style={{ position:'absolute', top:10, right:10, background:'rgba(7,7,15,0.85)', border:'1px solid rgba(212,175,55,0.4)', color:'#d4af37', fontSize:13, fontWeight:900, padding:'4px 10px', borderRadius:20, backdropFilter:'blur(8px)', fontFamily:'Georgia,serif' }}>
          {product.price}π
        </div>
      </div>
      <div style={{ padding:14 }}>
        <h2 style={{ fontSize:14, fontWeight:700, marginBottom:6, color:'#e8d5a3', lineHeight:1.3 }}>{label}</h2>
        <p style={{ fontFamily:'system-ui,sans-serif', fontSize:11, color:'#4a4a5a', lineHeight:1.5, marginBottom:14 }}>{product.description}</p>
        <button
          onClick={e => { e.stopPropagation(); piReady && onBuy(product); }}
          disabled={!piReady}
          style={{ width:'100%', padding:10, borderRadius:12, border:'none', background: piReady ? 'linear-gradient(135deg,#d4af37,#b8882a)' : '#1e1e2a', color: piReady ? '#07070f' : '#3a3a4a', fontSize:13, fontWeight:800, fontFamily:'system-ui,sans-serif', cursor: piReady ? 'pointer' : 'not-allowed', letterSpacing:'0.03em' }}>
          {piReady ? 'Buy Now' : 'Connecting...'}
        </button>
      </div>
    </article>
  );
}
