'use client';
type PayStatus = 'idle' | 'creating' | 'paying' | 'success' | 'cancelled' | 'error';

interface Product { id: string; title: string; name?: string; price: number }
interface Props {
  status:    PayStatus;
  product:   Product;
  message?:  string;
  onClose:   () => void;
  onRetry:   () => void;
}

export function PaymentModal({ status, product, message, onClose, onRetry }: Props) {
  const label = product.title ?? product.name;

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:999, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(16px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
      onClick={['success','cancelled','error'].includes(status) ? onClose : undefined}
    >
      <div
        style={{ width:'100%', maxWidth:320, borderRadius:28, background:'#0d0d18', border:'1px solid rgba(212,175,55,0.2)', padding:'36px 28px', textAlign:'center', boxShadow:'0 40px 80px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width:56, height:56, borderRadius:18, background:'linear-gradient(135deg,#d4af37,#8b6914)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, color:'#07070f', margin:'0 auto 14px', boxShadow:'0 8px 24px rgba(212,175,55,0.25)' }}>T</div>
        <p style={{ fontFamily:'system-ui,sans-serif', fontSize:12, color:'#4a4a5a', marginBottom:6, letterSpacing:'0.04em', textTransform:'uppercase' }}>{label}</p>
        <div style={{ fontSize:44, fontWeight:900, color:'#d4af37', marginBottom:28, letterSpacing:'-0.02em' }}>{product.price}π</div>

        {(status === 'creating' || status === 'paying') && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid rgba(212,175,55,0.15)', borderTopColor:'#d4af37', animation:'spin 0.8s linear infinite' }} />
            <p style={{ fontFamily:'system-ui,sans-serif', fontSize:13, color:'#4a4a5a' }}>
              {status === 'creating' ? 'Preparing payment...' : 'Confirm in Pi Wallet...'}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:44 }}>✅</div>
            <p style={{ fontFamily:'system-ui,sans-serif', fontSize:16, fontWeight:700, color:'#7ee7c0' }}>Payment Successful!</p>
            <button onClick={onClose} style={btnPrimary}>Done</button>
          </div>
        )}

        {status === 'cancelled' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:44 }}>⚠️</div>
            <p style={{ fontFamily:'system-ui,sans-serif', fontSize:14, fontWeight:700, color:'#f0c040' }}>Cancelled</p>
            <div style={{ display:'flex', gap:8, marginTop:6 }}>
              <button onClick={onRetry}  style={btnPrimary}>Try Again</button>
              <button onClick={onClose}  style={btnSecondary}>Close</button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:44 }}>❌</div>
            <p style={{ fontFamily:'system-ui,sans-serif', fontSize:14, fontWeight:700, color:'#e74c3c' }}>Payment Failed</p>
            {message && <p style={{ fontFamily:'system-ui,sans-serif', fontSize:11, color:'#4a4a5a', maxWidth:220 }}>{message}</p>}
            <div style={{ display:'flex', gap:8, marginTop:6 }}>
              <button onClick={onRetry} style={btnPrimary}>Try Again</button>
              <button onClick={onClose} style={btnSecondary}>Close</button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const btnPrimary:   React.CSSProperties = { padding:'12px 28px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#d4af37,#b8882a)', color:'#07070f', fontSize:13, fontWeight:800, fontFamily:'system-ui,sans-serif', cursor:'pointer' };
const btnSecondary: React.CSSProperties = { padding:'12px 20px', borderRadius:14, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#888', fontSize:13, fontFamily:'system-ui,sans-serif', cursor:'pointer' };
