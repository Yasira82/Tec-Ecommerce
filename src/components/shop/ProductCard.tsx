'use client';

interface Product {
  id: string; title: string; name?: string;
  description: string; price: number;
  images?: string[]; image_url?: string;
}

interface Props {
  product: Product;
  onBuy:   (p: Product) => void;
  delay?:  number;
}

export function ProductCard({ product, onBuy, delay = 0 }: Props) {
  const imgSrc = product.images?.[0] ?? product.image_url;
  const label  = product.title ?? product.name ?? 'Product';

  return (
    <article
      style={{
        borderRadius: 16, overflow: 'hidden',
        background: '#0d0d18', border: '1px solid rgba(212,175,55,0.1)',
        animation: `fadeUp 0.4s ease ${delay}ms both`,
        transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <div style={{ position: 'relative' }}>
        {imgSrc
          ? <img src={imgSrc} alt={label} style={{ width:'100%', height:140, objectFit:'cover', display:'block' }} />
          : <div style={{ width:'100%', height:140, background:'linear-gradient(135deg,#0d0d18,#141428)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, opacity:0.3 }}>🛍</div>
        }
        <div style={{ position:'absolute', top:10, right:10, background:'rgba(7,7,15,0.88)', border:'1px solid rgba(212,175,55,0.4)', color:'#d4af37', fontSize:12, fontWeight:900, padding:'3px 9px', borderRadius:20, fontFamily:'Georgia', backdropFilter:'blur(8px)' }}>
          {product.price}π
        </div>
      </div>
      <div style={{ padding: 12 }}>
        <h3 style={{ fontSize:13, fontWeight:700, color:'#e8d5a3', lineHeight:1.3, marginBottom:5 }}>{label}</h3>
        <p style={{ fontFamily:'system-ui', fontSize:11, color:'#4a4a5a', lineHeight:1.5, marginBottom:12, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {product.description}
        </p>
        <button
          onClick={() => onBuy(product)}
          style={{
            width:'100%', padding:10, borderRadius:12, border:'none',
            background:'linear-gradient(135deg,#d4af37,#b8882a)',
            color:'#07070f', fontSize:12, fontWeight:800,
            fontFamily:'system-ui', cursor:'pointer',
          }}
        >
          Buy Now
        </button>
      </div>
    </article>
  );
}
