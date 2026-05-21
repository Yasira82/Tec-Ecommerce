export function ShopHero() {
  return (
    <section style={{ position:'relative', textAlign:'center', padding:'48px 20px 40px', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-60, left:'50%', transform:'translateX(-50%)', width:400, height:200, background:'radial-gradient(ellipse,rgba(212,175,55,0.15) 0%,transparent 70%)', pointerEvents:'none' }} />
      <h1 style={{ fontSize:'clamp(28px,6vw,42px)', fontWeight:900, letterSpacing:'-0.02em', background:'linear-gradient(135deg,#d4af37 0%,#e8d5a3 50%,#b8882a 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', marginBottom:10 }}>
        Digital Marketplace
      </h1>
      <p style={{ fontFamily:'system-ui,sans-serif', fontSize:14, color:'#4a4a5a', letterSpacing:'0.08em', textTransform:'uppercase' }}>
        Pay instantly with Pi Network
      </p>
    </section>
  );
}
