'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter }                     from 'next/navigation';
import { ShopHeader }                    from '@/components/shop/ShopHeader';
import { EcommerceDrawer }               from '@/components/shop/EcommerceDrawer';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';
const SSO_URL = `${HUB_URL}/api/auth/sso?target=${encodeURIComponent(APP_URL + '/orders')}`;

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
  pending:   { label: 'Pending',   color: '#f0c040', bg: 'rgba(240,192,64,0.1)',  icon: '⏳' },
  paid:      { label: 'Paid',      color: '#7ee7c0', bg: 'rgba(126,231,192,0.1)', icon: '✅' },
  shipped:   { label: 'Shipped',   color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  icon: '🚚' },
  completed: { label: 'Completed', color: '#10b981', bg: 'rgba(16,185,129,0.1)',  icon: '🎉' },
  refunded:  { label: 'Refunded',  color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', icon: '↩️' },
  cancelled: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: '✕'  },
};

const PROGRESS_STEPS  = ['pending', 'paid', 'shipped', 'completed'];
const PROGRESS_LABELS = ['Ordered', 'Paid', 'Shipped', 'Delivered'];

/* ─── helpers ─── */
const getToken = () =>
  typeof document === 'undefined'
    ? null
    : document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1] ?? null;

const getStoredUser = () => {
  try {
    const raw = document.cookie.split('; ').find(r => r.startsWith('tec_user='))?.split('=')?.[1] ?? '';
    return raw ? JSON.parse(decodeURIComponent(raw)) : null;
  } catch { return null; }
};

const formatRelative = (iso: string) => {
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)     return 'Just now';
    if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return 'Yesterday';
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
};

const formatFull = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

const orderTotal = (o: Order) =>
  o.total ?? o.items?.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0) ?? 0;

/* ─── Skeleton card ─── */
function OrderSkeleton() {
  return (
    <div className="order-card" style={{ gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skel" style={{ width: 40,  height: 8  }} />
          <div className="skel" style={{ width: 110, height: 14 }} />
        </div>
        <div className="skel" style={{ width: 76, height: 28, borderRadius: 20 }} />
      </div>
      <div className="skel" style={{ width: '100%', height: 54, borderRadius: 10 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="skel" style={{ width: 110, height: 10 }} />
        <div className="skel" style={{ width: 52,  height: 20 }} />
      </div>
      <div className="skel" style={{ width: '100%', height: 22, borderRadius: 6 }} />
    </div>
  );
}

/* ─── Progress tracker ─── */
function OrderProgress({ status }: { status: string }) {
  const isFinal    = status === 'cancelled' || status === 'refunded';
  const currentIdx = PROGRESS_STEPS.indexOf(status);

  if (isFinal) {
    const cfg = STATUS_CONFIG[status];
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: cfg.bg,
        border: `1px solid ${cfg.color}28`,
        borderRadius: 10,
      }}>
        <span>{cfg.icon}</span>
        <span style={{ fontFamily: 'system-ui', fontSize: 12, color: cfg.color, fontWeight: 600 }}>
          Order {cfg.label}
        </span>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {PROGRESS_STEPS.map((step, idx) => {
          const done    = idx <= currentIdx;
          const current = idx === currentIdx;
          const last    = idx === PROGRESS_STEPS.length - 1;
          return (
            <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: idx === 0 ? 'flex-start' : last ? 'flex-end' : 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                {idx > 0 && (
                  <div style={{ flex: 1, height: 2, background: done ? 'linear-gradient(90deg,#b8882a,#d4af37)' : '#1e1e2a', transition: 'background 0.4s' }} />
                )}
                <div style={{
                  width:  current ? 13 : 9,
                  height: current ? 13 : 9,
                  borderRadius: '50%',
                  flexShrink: 0,
                  transition: 'all 0.35s',
                  background: done ? '#d4af37' : '#1a1a2a',
                  border: `2px solid ${done ? '#d4af37' : '#2a2a3a'}`,
                  boxShadow: current ? '0 0 8px rgba(212,175,55,0.55)' : 'none',
                  zIndex: 1,
                }} />
                {!last && (
                  <div style={{ flex: 1, height: 2, background: done && !current ? 'linear-gradient(90deg,#d4af37,#b8882a)' : '#1e1e2a', transition: 'background 0.4s' }} />
                )}
              </div>
              <div style={{
                fontFamily: 'system-ui',
                fontSize: 9,
                marginTop: 5,
                fontWeight: current ? 700 : 500,
                color: done ? (current ? '#d4af37' : '#9a7a30') : '#2e2e3e',
                textAlign: idx === 0 ? 'left' : last ? 'right' : 'center',
                letterSpacing: 0.2,
              }}>
                {PROGRESS_LABELS[idx]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Single order card ─── */
function OrderCard({ order, index }: { order: Order; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copied,   setCopied]   = useState(false);

  const cfg       = STATUS_CONFIG[order.status] ?? { label: order.status, color: '#888', bg: 'rgba(255,255,255,0.04)', icon: '•' };
  const total     = orderTotal(order);
  const itemCount = order.items?.reduce((s, i) => s + i.qty, 0) ?? 1;
  const shortId   = '#' + order.id.slice(-8).toUpperCase();

  const copyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(order.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <article
      className="order-card"
      style={{ animationDelay: `${index * 55}ms`, cursor: 'pointer' }}
      onClick={() => setExpanded(p => !p)}
    >
      {/* Header */}
      <div className="order-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: 'system-ui', fontSize: 9, color: '#4a4a5a', letterSpacing: 1.2, textTransform: 'uppercase' }}>Order</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'system-ui', fontSize: 13, fontWeight: 700, color: '#aaa' }}>{shortId}</span>
            <button
              onClick={copyId}
              style={{
                fontFamily: 'system-ui', fontSize: 9,
                padding: '2px 8px', borderRadius: 8,
                border: `1px solid ${copied ? 'rgba(126,231,192,0.3)' : 'rgba(255,255,255,0.08)'}`,
                background: copied ? 'rgba(126,231,192,0.08)' : 'transparent',
                color: copied ? '#7ee7c0' : '#4a4a5a',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {copied ? '✓ Copied' : 'Copy ID'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          <span className="status-badge" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
            {cfg.icon} {cfg.label}
          </span>
          <span style={{ fontFamily: 'system-ui', fontSize: 9, color: '#4a4a5a' }}>
            {formatRelative(order.created_at)}
          </span>
        </div>
      </div>

      {/* Items */}
      {order.items && order.items.length > 0 && (
        <div className="order-items">
          {order.items.slice(0, expanded ? undefined : 2).map((item, j) => (
            <div key={j} className="order-item">
              <div className="item-dot" />
              <span className="item-title">{item.title ?? `Product ${item.productId.slice(-6)}`}</span>
              <span className="item-qty">×{item.qty}</span>
              {item.price !== undefined && (
                <span className="item-price">{(item.price * item.qty).toFixed(2)}π</span>
              )}
            </div>
          ))}
          {!expanded && order.items.length > 2 && (
            <div style={{ fontFamily: 'system-ui', fontSize: 11, color: '#d4af37', paddingLeft: 13, marginTop: 2, opacity: 0.8 }}>
              +{order.items.length - 2} more items
            </div>
          )}
        </div>
      )}

      {order.memo && !order.items?.length && (
        <p style={{ fontFamily: 'system-ui', fontSize: 12, color: '#6b6b7a', padding: '2px 0' }}>{order.memo}</p>
      )}

      {/* Footer */}
      <div className="order-footer">
        <span style={{ fontFamily: 'system-ui', fontSize: 11, color: '#4a4a5a' }}>
          {itemCount} item{itemCount !== 1 ? 's' : ''} · {formatRelative(order.created_at)}
        </span>
        {total > 0 && (
          <span style={{ fontFamily: 'Georgia,serif', fontSize: 18, fontWeight: 900, color: '#d4af37' }}>
            {total.toFixed(2)}π
          </span>
        )}
      </div>

      {/* Progress */}
      <OrderProgress status={order.status} />

      {/* Expanded detail */}
      {expanded && (
        <div className="detail-panel" onClick={e => e.stopPropagation()}>
          <div style={{ fontFamily: 'system-ui', fontSize: 9, color: '#4a4a5a', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
            Order Details
          </div>
          <div className="detail-row">
            <span className="detail-label">Order ID</span>
            <span className="detail-value mono">{order.id}</span>
          </div>
          {order.payment_id && (
            <div className="detail-row">
              <span className="detail-label">Payment ID</span>
              <span className="detail-value mono">{order.payment_id.slice(0, 22)}…</span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-label">Date</span>
            <span className="detail-value">{formatFull(order.created_at)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Status</span>
            <span className="detail-value" style={{ color: cfg.color, fontWeight: 700 }}>
              {cfg.icon} {cfg.label}
            </span>
          </div>
          {total > 0 && (
            <div className="detail-row">
              <span className="detail-label">Total</span>
              <span className="detail-value" style={{ color: '#d4af37', fontWeight: 800, fontFamily: 'Georgia,serif', fontSize: 14 }}>
                {total.toFixed(2)} π
              </span>
            </div>
          )}
          {order.memo && (
            <div className="detail-row">
              <span className="detail-label">Memo</span>
              <span className="detail-value">{order.memo}</span>
            </div>
          )}
        </div>
      )}

      {/* Expand hint */}
      <div style={{ textAlign: 'center', marginTop: -6 }}>
        <span style={{ fontFamily: 'system-ui', fontSize: 10, color: '#2e2e3e', userSelect: 'none' }}>
          {expanded ? '▲ collapse' : '▼ view details'}
        </span>
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════ */
export default function OrdersPage() {
  const router = useRouter();

  const [authed,     setAuthed]     = useState<boolean | null>(null);
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [fetching,   setFetching]   = useState(true);
  const [piReady,    setPiReady]    = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [username,   setUsername]   = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<string>('all');
  const [search,     setSearch]     = useState('');

  useEffect(() => {
    if (!getToken()) { window.location.href = SSO_URL; return; }
    setAuthed(true);
    const user = getStoredUser();
    if (user?.piUsername) setUsername(user.piUsername);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__TEC_PI_READY) { setPiReady(true); return; }
    const h = () => setPiReady(true);
    window.addEventListener('tec-pi-ready', h, { once: true });
    return () => window.removeEventListener('tec-pi-ready', h);
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetch('/api/bff/orders', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { window.location.href = SSO_URL; throw new Error(); }
        return r.json();
      })
      .then(d => {
        const list = d?.data?.orders ?? d?.orders ?? [];
        setOrders(Array.isArray(list) ? list : []);
      })
      .catch(() => setOrders([]))
      .finally(() => setFetching(false));
  }, [authed]);

  const tabs = useMemo(
    () => ['all', ...Array.from(new Set(orders.map(o => o.status)))],
    [orders],
  );

  const totalSpent = useMemo(
    () => orders.reduce((s, o) => s + orderTotal(o), 0),
    [orders],
  );

  const filtered = useMemo(() => {
    let list = activeTab === 'all' ? orders : orders.filter(o => o.status === activeTab);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(o =>
      o.id.toLowerCase().includes(q) ||
      o.memo?.toLowerCase().includes(q) ||
      o.items?.some(i => (i.title ?? '').toLowerCase().includes(q)),
    );
    return list;
  }, [orders, activeTab, search]);

  const clearFilters = () => { setSearch(''); setActiveTab('all'); };

  /* Loading skeleton */
  if (authed === null || (authed && fetching)) return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight: '100vh', background: '#07070f', color: '#fff' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px 48px' }}>
          <div className="skel" style={{ width: 150, height: 28, marginBottom: 8 }} />
          <div className="skel" style={{ width: 95,  height: 12, marginBottom: 26 }} />
          <div className="skel" style={{ width: '100%', height: 68, borderRadius: 16, marginBottom: 20 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <OrderSkeleton /><OrderSkeleton /><OrderSkeleton />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#07070f', color: '#fff', fontFamily: 'Georgia,serif' }}>
      <style>{CSS}</style>

      <EcommerceDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        username={username ?? undefined}
        hubUrl={HUB_URL}
      />
      <ShopHeader piReady={piReady} onMenuOpen={() => setDrawerOpen(true)} />

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px 56px' }}>

        {/* Page title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#e8d5a3', marginBottom: 4 }}>My Orders</h1>
            <p style={{ fontFamily: 'system-ui', fontSize: 12, color: '#4a4a5a' }}>
              {orders.length} order{orders.length !== 1 ? 's' : ''} in total
            </p>
          </div>
          <button onClick={() => router.push('/')} className="btn-primary">🛍 Shop More</button>
        </div>

        {/* Stats bar */}
        {orders.length > 0 && (
          <div className="stats-bar">
            <div className="stat-cell">
              <div className="stat-val">{orders.length}</div>
              <div className="stat-lbl">Orders</div>
            </div>
            <div className="stat-sep" />
            <div className="stat-cell">
              <div className="stat-val" style={{ color: '#d4af37', fontFamily: 'Georgia,serif' }}>
                {totalSpent.toFixed(2)}π
              </div>
              <div className="stat-lbl">Total Spent</div>
            </div>
            <div className="stat-sep" />
            <div className="stat-cell">
              <div className="stat-val" style={{ color: '#10b981' }}>
                {orders.filter(o => o.status === 'completed').length}
              </div>
              <div className="stat-lbl">Completed</div>
            </div>
            <div className="stat-sep" />
            <div className="stat-cell">
              <div className="stat-val" style={{ color: '#f0c040' }}>
                {orders.filter(o => ['pending','paid','shipped'].includes(o.status)).length}
              </div>
              <div className="stat-lbl">Active</div>
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.35, pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by order ID or product name…"
            className="search-box"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b6b7a', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 4 }}>
            {tabs.map(tab => {
              const cfg   = STATUS_CONFIG[tab];
              const count = tab === 'all' ? orders.length : orders.filter(o => o.status === tab).length;
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="tab-btn"
                  style={active && cfg
                    ? { borderColor: cfg.color, color: cfg.color, background: cfg.bg }
                    : active
                    ? { borderColor: 'rgba(212,175,55,0.35)', color: '#d4af37', background: 'rgba(212,175,55,0.08)' }
                    : {}}
                >
                  {tab === 'all'
                    ? `All (${count})`
                    : `${cfg?.icon ?? ''} ${cfg?.label ?? tab} (${count})`}
                </button>
              );
            })}
          </div>
        )}

        {/* Search result label */}
        {search.trim() && (
          <p style={{ fontFamily: 'system-ui', fontSize: 12, color: '#6b6b7a', marginBottom: 12 }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{search.trim()}&rdquo;
          </p>
        )}

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 0' }}>
            <div style={{ fontSize: 52, opacity: 0.2, marginBottom: 16 }}>🧾</div>
            <p style={{ fontFamily: 'system-ui', fontSize: 16, color: '#3a3a4a', marginBottom: 6 }}>
              {search.trim()
                ? 'No orders match your search'
                : activeTab === 'all'
                ? 'No orders yet'
                : `No ${STATUS_CONFIG[activeTab]?.label ?? activeTab} orders`}
            </p>
            <p style={{ fontFamily: 'system-ui', fontSize: 12, color: '#2a2a3a', marginBottom: 22 }}>
              {search.trim()
                ? 'Try a different order ID or product name'
                : activeTab === 'all'
                ? 'Your purchase history will appear here'
                : 'Switch to "All" to see every order'}
            </p>
            {!search.trim() && activeTab === 'all' ? (
              <button onClick={() => router.push('/')} className="btn-primary">Start Shopping →</button>
            ) : (
              <button onClick={clearFilters} className="btn-ghost">Clear filters</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map((order, i) => (
              <OrderCard key={order.id} order={order} index={i} />
            ))}
          </div>
        )}

      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════ */
const CSS = `
  @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shimmer { 0%{background-position:-500px 0} 100%{background-position:500px 0} }

  .skel {
    border-radius: 6px;
    background: linear-gradient(90deg, #0d0d18 25%, #13132a 50%, #0d0d18 75%);
    background-size: 500px 100%;
    animation: shimmer 1.4s ease-in-out infinite;
  }

  .stats-bar {
    display: flex;
    align-items: center;
    background: #0d0d18;
    border: 1px solid rgba(212,175,55,0.1);
    border-radius: 16px;
    padding: 16px 20px;
    margin-bottom: 20px;
  }
  .stat-cell  { flex: 1; text-align: center; }
  .stat-val   { font-family: system-ui; font-size: 18px; font-weight: 900; color: #e8d5a3; margin-bottom: 3px; }
  .stat-lbl   { font-family: system-ui; font-size: 9px; color: #4a4a5a; text-transform: uppercase; letter-spacing: 0.6px; }
  .stat-sep   { width: 1px; height: 34px; background: rgba(255,255,255,0.06); margin: 0 6px; flex-shrink: 0; }

  .search-box {
    width: 100%;
    box-sizing: border-box;
    padding: 11px 38px 11px 40px;
    background: #0d0d18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    color: #e0e0e0;
    font-family: system-ui;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .search-box::placeholder { color: #363646; }
  .search-box:focus {
    border-color: rgba(212,175,55,0.32);
    box-shadow: 0 0 0 3px rgba(212,175,55,0.06);
  }

  .btn-primary {
    padding: 10px 20px;
    border-radius: 12px;
    border: 1px solid rgba(212,175,55,0.28);
    background: rgba(212,175,55,0.07);
    color: #d4af37;
    font-family: system-ui;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .btn-primary:hover { background: rgba(212,175,55,0.14); }

  .btn-ghost {
    padding: 9px 22px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.1);
    background: transparent;
    color: #6b6b7a;
    font-family: system-ui;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-ghost:hover { border-color: rgba(255,255,255,0.22); color: #aaa; }

  .tab-btn {
    padding: 7px 14px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
    color: #6b6b7a;
    font-family: system-ui;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .tab-btn:hover { border-color: rgba(255,255,255,0.16); color: #999; }

  .order-card {
    border-radius: 20px;
    background: #0d0d18;
    border: 1px solid rgba(212,175,55,0.1);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: fadeUp 0.4s ease both;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
  }
  .order-card:hover {
    border-color: rgba(212,175,55,0.22);
    box-shadow: 0 8px 30px rgba(0,0,0,0.35);
    transform: translateY(-2px);
  }

  .order-header { display: flex; align-items: flex-start; justify-content: space-between; }

  .status-badge {
    font-family: system-ui;
    font-size: 11px;
    font-weight: 700;
    padding: 5px 12px;
    border-radius: 20px;
    white-space: nowrap;
    letter-spacing: 0.2px;
  }

  .order-items {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 12px;
    background: rgba(255,255,255,0.02);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.04);
  }
  .order-item  { display: flex; align-items: center; gap: 8px; }
  .item-dot    { width: 5px; height: 5px; border-radius: 50%; background: #d4af37; opacity: 0.45; flex-shrink: 0; }
  .item-title  { font-family: system-ui; font-size: 12px; color: #888; flex: 1; line-height: 1.4; }
  .item-qty    { font-family: system-ui; font-size: 11px; color: #4a4a5a; flex-shrink: 0; }
  .item-price  { font-family: Georgia,serif; font-size: 12px; color: #d4af37; font-weight: 700; flex-shrink: 0; }

  .order-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 6px;
    border-top: 1px solid rgba(255,255,255,0.04);
  }

  .detail-panel {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 9px;
    animation: fadeUp 0.22s ease both;
  }
  .detail-row   { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; }
  .detail-label { font-family: system-ui; font-size: 11px; color: #4a4a5a; flex-shrink: 0; }
  .detail-value { font-family: system-ui; font-size: 11px; color: #aaa; text-align: right; word-break: break-all; line-height: 1.5; }
  .mono         { font-family: 'Menlo','Courier New',monospace; font-size: 10px !important; color: #888 !important; }
`;
