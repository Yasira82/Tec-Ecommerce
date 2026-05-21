'use client';

import { useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';
import { usePiAuth }           from '@yasser172/tec-auth';
import { ShopHeader }          from '@/components/shop/ShopHeader';
import { EcommerceDrawer }     from '@/components/shop/EcommerceDrawer';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';

interface OrderItem { productId: string; qty: number; price?: number; title?: string }
interface Order {
  id: string;
  status: string;
  total?: number;
  items?: OrderItem[];
  created_at: string;
  payment_id?: string;
  memo?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:    { label: 'Pending',    color: '#f0c040', bg: 'rgba(240,192,64,0.1)',  icon: '⏳' },
  paid:       { label: 'Paid',       color: '#7ee7c0', bg: 'rgba(126,231,192,0.1)', icon: '✅' },
  shipped:    { label: 'Shipped',    color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  icon: '🚚' },
  completed:  { label: 'Completed',  color: '#10b981', bg: 'rgba(16,185,129,0.1)',  icon: '🎉' },
  refunded:   { label: 'Refunded',   color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', icon: '↩️' },
  cancelled:  { label: 'Cancelled',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: '✕'  },
};

const getStoredUser = () => {
  try {
    const raw = document.cookie.split('; ').find(r => r.startsWith('tec_user='))?.split('=')?.[1] ?? '';
    return raw ? JSON.parse(decodeURIComponent(raw)) : null;
  } catch { return null; }
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' });
  } catch { return iso; }
};

export default function OrdersPage() {
  const router                              = useRouter();
  const { isAuthenticated, isLoading: authLoading } = usePiAuth();

  const [orders,     setOrders]     = useState<Order[]>([]);
  const [fetching,   setFetching]   = useState(true);
  const [piReady,    setPiReady]    = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [username,   setUsername]   = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<string>('all');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__TEC_PI_READY) { setPiReady(true); return; }
    const h = () => setPiReady(true);
    window.addEventListener('tec-pi-ready', h, { once: true });
    return () => window.removeEventListener('tec-pi-ready', h);
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = `${HUB_URL}/api/auth/sso?target=${encodeURIComponent(APP_URL + '/orders')}`;
    }
    if (isAuthenticated) {
      const user = getStoredUser();
      if (user?.piUsername) setUsername(user.piUsername);
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/bff/orders', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const list = d?.data?.orders ?? d?.orders ?? [];
        setOrders(Array.isArray(list) ? list : []);
      })
      .catch(() => setOrders([]))
      .finally(() => setFetching(false));
  }, [isAuthenticated]);

  const filtered = activeTab === 'all' ? orders : orders.filter(o => o.status === activeTab);
  const tabs     = ['all', ...Array.from(new Set(orders.map(o => o.status)))];

  if (authLoading || fetching) return (
    <>
      <style>{CSS}</style>
      <div className="center-screen"><div className="spinner" /></div>
    </>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#07070f', color:'#fff', fontFamily:'Georgia,serif' }}>
      <style>{CSS}</style>

      <EcommerceDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} username={username ?? undefined} hubUrl={HUB_URL} />
      <ShopHeader piReady={piReady} onMenuOpen={() => setDrawerOpen(true)} />

      <main style={{ maxWidth:800, margin:'0 auto', padding:'24px 20px 48px' }}>

        {/* ── Page Header ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:900, color:'#e8d5a3', marginBottom:4 }}>My Orders</h1>
            <p style={{ fontFamily:'system-ui', fontSize:12, color:'#4a4a5a' }}>{orders.length} total orders</p>
          </div>
          <button onClick={() => router.push('/')} className="btn-shop">🛍 Shop More</button>
        </div>

        {/* ── Tabs ── */}
        {tabs.length > 1 && (
          <div style={{ display:'flex', gap:8, marginBottom:20, overflowX:'auto', paddingBottom:4 }}>
            {tabs.map(tab => {
              const cfg = STATUS_CONFIG[tab];
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`tab-btn ${activeTab === tab ? 'tab-btn--active' : ''}`}
                  style={activeTab === tab && cfg ? { borderColor: cfg.color, color: cfg.color, background: cfg.bg } : {}}>
                  {tab === 'all' ? `All (${orders.length})` : `${cfg?.icon ?? ''} ${cfg?.label ?? tab}`}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Empty ── */}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'80px 0' }}>
            <div style={{ fontSize:56, marginBottom:16, opacity:0.3 }}>🧾</div>
            <p style={{ fontFamily:'system-ui', fontSize:16, color:'#3a3a4a', marginBottom:8 }}>
              {activeTab === 'all' ? 'No orders yet' : `No ${activeTab} orders`}
            </p>
            {activeTab === 'all' && (
              <button onClick={() => router.push('/')} className="btn-shop" style={{ marginTop:16 }}>
                Start Shopping →
              </button>
            )}
          </div>
        )}

        {/* ── Orders List ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {filtered.map((order, i) => {
            const cfg     = STATUS_CONFIG[order.status] ?? { label: order.status, color:'#888', bg:'rgba(255,255,255,0.04)', icon:'•' };
            const total   = order.total ?? order.items?.reduce((s, item) => s + (item.price ?? 0) * item.qty, 0) ?? 0;
            const itemCount = order.items?.reduce((s, item) => s + item.qty, 0) ?? 1;

            return (
              <article key={order.id} className="order-card" style={{ animationDelay:`${i * 60}ms` }}>
                {/* Card Header */}
                <div className="order-header">
                  <div>
                    <div style={{ fontFamily:'system-ui', fontSize:10, color:'#4a4a5a', marginBottom:4, letterSpacing:1, textTransform:'uppercase' }}>Order</div>
                    <div style={{ fontFamily:'system-ui', fontSize:13, fontWeight:700, color:'#888' }}>#{order.id.slice(-8).toUpperCase()}</div>
                  </div>
                  <span className="status-badge" style={{ background: cfg.bg, color: cfg.color, border:`1px solid ${cfg.color}30` }}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>

                {/* Items */}
                {order.items && order.items.length > 0 && (
                  <div className="order-items">
                    {order.items.slice(0, 3).map((item, j) => (
                      <div key={j} className="order-item">
                        <div className="item-dot" />
                        <span className="item-title">{item.title ?? `Product ${item.productId.slice(-6)}`}</span>
                        <span className="item-qty">×{item.qty}</span>
                        {item.price && <span className="item-price">{item.price * item.qty}π</span>}
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <div style={{ fontFamily:'system-ui', fontSize:11, color:'#4a4a5a', paddingLeft:16 }}>+{order.items.length - 3} more items</div>
                    )}
                  </div>
                )}

                {order.memo && !order.items?.length && (
                  <p style={{ fontFamily:'system-ui', fontSize:12, color:'#6b6b7a', padding:'8px 0' }}>{order.memo}</p>
                )}

                {/* Card Footer */}
                <div className="order-footer">
                  <div style={{ fontFamily:'system-ui', fontSize:11, color:'#4a4a5a' }}>
                    {formatDate(order.created_at)} · {itemCount} item{itemCount > 1 ? 's' : ''}
                  </div>
                  {total > 0 && (
                    <div style={{ fontFamily:'Georgia,serif', fontSize:18, fontWeight:900, color:'#d4af37' }}>{total}π</div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="progress-wrap">
                  {['pending','paid','shipped','completed'].map((step, si) => {
                    const steps   = ['pending','paid','shipped','completed'];
                    const current = steps.indexOf(order.status);
                    const done    = si <= current;
                    return (
                      <div key={step} className="progress-step">
                        <div className={`progress-dot ${done ? 'progress-dot--done' : ''}`} />
                        <div className={`progress-line ${si < steps.length - 1 ? 'visible' : ''} ${done && si < steps.length - 1 ? 'progress-line--done' : ''}`} />
                        <div className={`progress-label ${done ? 'progress-label--done' : ''}`}>{STATUS_CONFIG[step]?.icon}</div>
                      </div>
                    );
                  })}
                </div>

              </article>
            );
          })}
        </div>

      </main>
    </div>
  );
}

const CSS = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  @keyframes spin   { to{transform:rotate(360deg)} }

  .center-screen { min-height:100vh; background:#07070f; display:flex; align-items:center; justify-content:center; }
  .spinner { width:32px; height:32px; border-radius:50%; border:3px solid rgba(212,175,55,0.15); border-top-color:#d4af37; animation:spin 0.8s linear infinite; }

  .btn-shop { padding:10px 20px; border-radius:12px; border:1px solid rgba(212,175,55,0.25); background:rgba(212,175,55,0.06); color:#d4af37; font-family:system-ui; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; transition:background 0.15s; }
  .btn-shop:hover { background:rgba(212,175,55,0.12); }

  .tab-btn { padding:7px 16px; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); color:#6b6b7a; font-family:system-ui; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap; transition:all 0.15s; }
  .tab-btn--active { border-color:rgba(212,175,55,0.35); color:#d4af37; background:rgba(212,175,55,0.08); }

  .order-card { border-radius:20px; background:#0d0d18; border:1px solid rgba(212,175,55,0.1); padding:20px; display:flex; flex-direction:column; gap:14px; animation:fadeUp 0.4s ease both; }

  .order-header { display:flex; align-items:flex-start; justify-content:space-between; }
  .status-badge { font-family:system-ui; font-size:11px; font-weight:700; padding:5px 12px; border-radius:20px; white-space:nowrap; }

  .order-items { display:flex; flex-direction:column; gap:6px; padding:12px; background:rgba(255,255,255,0.02); border-radius:12px; border:1px solid rgba(255,255,255,0.04); }
  .order-item  { display:flex; align-items:center; gap:8px; }
  .item-dot    { width:5px; height:5px; border-radius:50%; background:#d4af37; opacity:0.5; flex-shrink:0; }
  .item-title  { font-family:system-ui; font-size:12px; color:#888; flex:1; }
  .item-qty    { font-family:system-ui; font-size:11px; color:#4a4a5a; }
  .item-price  { font-family:Georgia; font-size:12px; color:#d4af37; font-weight:700; }

  .order-footer { display:flex; align-items:center; justify-content:space-between; padding-top:4px; border-top:1px solid rgba(255,255,255,0.04); }

  .progress-wrap  { display:flex; align-items:center; }
  .progress-step  { display:flex; align-items:center; flex:1; flex-direction:column; }
  .progress-dot   { width:8px; height:8px; border-radius:50%; background:#1e1e2a; border:2px solid #2a2a3a; transition:all 0.3s; }
  .progress-dot--done { background:#d4af37; border-color:#d4af37; }
  .progress-line  { display:none; height:2px; flex:1; background:#1e1e2a; }
  .progress-line.visible { display:block; }
  .progress-line--done { background:linear-gradient(90deg,#d4af37,#b8882a); }
  .progress-label { font-size:10px; margin-top:4px; opacity:0.4; }
  .progress-label--done { opacity:1; }
  .progress-step  { flex-direction:row; }
  .progress-step  { gap:0; }
`;
