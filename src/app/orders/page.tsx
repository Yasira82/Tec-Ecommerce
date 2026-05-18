'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter }                         from 'next/navigation';
import { usePiAuth }                         from '@yasser172/tec-auth';
import { TEC_COLORS, formatPi, formatDate }  from '@yasser172/tec-ui';
import { Order }                             from '../../types';

// ── Utils (inline until @yasser172/tec-ui v1.1.0) ─────────
const formatPi = (amount: number | string, decimals = 2): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return isNaN(num) ? '0π' : `${num.toFixed(decimals)}π`;
};

const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ─────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:   { color: '#f59e0b', label: 'Pending',   icon: '⏳' },
  confirmed: { color: '#3b82f6', label: 'Confirmed', icon: '✅' },
  shipped:   { color: '#8b5cf6', label: 'Shipped',   icon: '🚚' },
  delivered: { color: '#10b981', label: 'Delivered', icon: '📦' },
  cancelled: { color: '#ef4444', label: 'Cancelled', icon: '❌' },
};

export default function OrdersPage() {
  const { isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  const [orders,   setOrders]   = useState<Order[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bff/orders', { credentials: 'include', cache: 'no-store' });
      if (res.ok) { const data = await res.json(); setOrders(data?.orders ?? []); }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) { router.push('/'); return; }
    if (!isLoading && isAuthenticated) fetchOrders();
  }, [isLoading, isAuthenticated, router, fetchOrders]);

  if (isLoading || loading) return (
    <div style={{ minHeight: '100vh', background: '#020205', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(212,175,55,0.15)', borderTopColor: TEC_COLORS.gold, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to{transform:rotate(360deg)} }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#020205', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif', paddingBottom: 32 }}>

      <header style={{ padding: '14px 16px', borderBottom: '1px solid #ffffff06', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: 'rgba(2,2,5,0.95)', backdropFilter: 'blur(20px)', zIndex: 100 }}>
        <button onClick={() => router.push('/shop')}
          style={{ background: '#ffffff08', border: '1px solid #ffffff10', borderRadius: 10, padding: '6px 12px', color: '#6b6b7a', fontSize: 14, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: TEC_COLORS.gold }}>🧾 My Orders</div>
      </header>

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15, color: '#4a4a5a' }}>No orders yet</div>
            <button onClick={() => router.push('/shop')}
              style={{ marginTop: 20, padding: '12px 24px', background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`, border: 'none', borderRadius: 14, color: '#0a0800', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Start Shopping
            </button>
          </div>
        ) : orders.map(order => {
          const cfg    = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
          const isOpen = expanded === order.id;
          return (
            <div key={order.id} onClick={() => setExpanded(isOpen ? null : order.id)}
              style={{ background: '#0d0d14', border: '1px solid #ffffff08', borderRadius: 16, padding: '14px 16px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: '#ffffff06', flexShrink: 0, overflow: 'hidden' }}>
                  {order.product?.images?.[0] ? (
                    <img src={order.product.images[0]} alt={order.product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🛍️</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {order.product?.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#4a4a5a', marginTop: 2 }}>
                    {formatDate(order.created_at)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: TEC_COLORS.gold }}>
                    {formatPi(order.amount)}
                  </div>
                  <div style={{ fontSize: 10, color: cfg.color, fontWeight: 700, marginTop: 2 }}>
                    {cfg.icon} {cfg.label}
                  </div>
                </div>
              </div>

              {isOpen && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #ffffff08' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Order ID', value: order.id.slice(0, 12) + '…'         },
                      { label: 'Payment',  value: order.payment_id.slice(0, 12) + '…' },
                    ].map(item => (
                      <div key={item.label} style={{ background: '#ffffff05', borderRadius: 10, padding: '8px 10px' }}>
                        <div style={{ fontSize: 9, color: '#4a4a5a', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</div>
                        <div style={{ fontSize: 11, color: '#fff', fontFamily: 'monospace' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
