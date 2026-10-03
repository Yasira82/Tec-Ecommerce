// The shape My Orders renders, read from what commerce-service actually sends.
//
// commerce sends Prisma rows: `total` and `price` are DECIMAL(20,8) — strings in
// JSON — status is UPPERCASE, a line's count is `quantity` and its name lives in
// `snapshot.title`. The page was written for numbers, lowercase and `qty`, so
// the first order with a total crashed it: `"12.00000000".toFixed` is not a
// function (3 Oct 2026 — the whole page went black).
//
// An order that was never paid and is now cancelled is a checkout the buyer
// walked away from (a released hold), not a purchase — it is not listed.

export interface OrderItemView { productId: string; qty: number; price?: number; title?: string }
export interface OrderView {
  id: string; status: string; total: number;
  items: OrderItemView[]; created_at: string;
  payment_id?: string; memo?: string;
}

/** Statuses the page knows; commerce's PROCESSING reads as paid, DELIVERED as completed. */
const STATUS: Record<string, string> = {
  PENDING: 'pending', PAID: 'paid', PROCESSING: 'paid', SHIPPED: 'shipped',
  DELIVERED: 'completed', COMPLETED: 'completed', CANCELLED: 'cancelled', REFUNDED: 'refunded',
};

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export function normalizeOrder(raw: unknown): OrderView | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const id = str(o.id);
  if (!id) return null;
  const rawStatus = String(o.status ?? '');
  const status = STATUS[rawStatus.toUpperCase()] ?? rawStatus.toLowerCase();

  const items: OrderItemView[] = (Array.isArray(o.items) ? o.items : []).map((r) => {
    const i = (r ?? {}) as Record<string, unknown>;
    const snap = (i.snapshot ?? {}) as Record<string, unknown>;
    return {
      productId: String(i.product_id ?? i.productId ?? ''),
      qty:       num(i.quantity ?? i.qty) ?? 1,
      price:     num(i.price),
      title:     str(i.title) ?? str(snap.title),
    };
  });
  const total = num(o.total) ?? items.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);

  return {
    id, status, total, items,
    created_at: String(o.created_at ?? ''),
    payment_id: str(o.payment_id),
    memo:       str(o.memo) ?? str(o.notes),
  };
}

/** The list to show: normalized, without abandoned checkouts. */
export function ordersToShow(list: unknown): OrderView[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return !(String(o.status ?? '').toUpperCase() === 'CANCELLED' && !o.paid_at);
    })
    .map(normalizeOrder)
    .filter((o): o is OrderView => o !== null);
}

/** What the buyer has spent: paid orders only — not a pending hold, not a refund. */
export const PAID_STATUSES = new Set(['paid', 'shipped', 'completed']);
