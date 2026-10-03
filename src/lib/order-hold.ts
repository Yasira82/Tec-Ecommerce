// Server-only. Reserve the units BEFORE the buyer pays (commerce-service holds).
//
// purchase-guard.ts says "is this still possible?" — but two buyers could both
// hear "yes" for the last unit, both pay, and only one could be served. A hold
// TAKES the stock now: commerce-service decrements it with one conditional
// UPDATE, so exactly one buyer gets the last unit and the other is told before
// any π moves. The payment then carries `order_id`, and the order turns PAID
// from the payment's own event (or the buyer's confirm, which commerce checks
// with payment-service). An unpaid hold is released by commerce after its TTL.

import type { PurchaseLine } from './purchase-guard';

export type HoldResult =
  | { ok: true; orderId: string }
  /** commerce-service predates holds (deploy order) — carry on as before. */
  | { ok: 'unsupported' }
  | { ok: false; status: number; error: 'OUT_OF_STOCK' | 'PRODUCT_UNAVAILABLE' | 'CHECK_FAILED' | 'UNAUTHORIZED'; message: string };

const CHECK_FAILED = {
  ok: false as const, status: 503, error: 'CHECK_FAILED' as const,
  message: 'Could not reserve this product right now — nothing was charged. Please try again.',
};

const messageOf = (body: unknown): string => {
  const m = (body as { message?: unknown } | null)?.message;
  return Array.isArray(m) ? m.join(' ') : typeof m === 'string' ? m : '';
};

export async function placeHold(
  lines: PurchaseLine[],
  gateway: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<HoldResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${gateway}/api/commerce/orders/hold`, {
      method:  'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ items: lines.map((l) => ({ product_id: l.productId, quantity: l.qty })) }),
      cache:   'no-store',
      signal:  AbortSignal.timeout(10_000),
    });
  } catch {
    return CHECK_FAILED;
  }
  const body = await res.json().catch(() => null);
  const msg  = messageOf(body);

  if (res.ok) {
    const id = (body as { data?: { order?: { id?: unknown } } } | null)?.data?.order?.id;
    return typeof id === 'string' && id ? { ok: true, orderId: id } : CHECK_FAILED;
  }
  // Nest's own "no such route" — the backend has not shipped holds yet.
  if (res.status === 404 && msg.startsWith('Cannot POST')) return { ok: 'unsupported' };
  if (res.status === 401) return { ok: false, status: 401, error: 'UNAUTHORIZED', message: 'Please sign in again.' };
  if (res.status === 400 && /insufficient stock/i.test(msg)) {
    const what = msg.replace(/^.*insufficient stock for:\s*/i, '').trim();
    return { ok: false, status: 409, error: 'OUT_OF_STOCK', message: `${what || 'This product'} is out of stock.` };
  }
  if (res.status === 400 || res.status === 404) {
    return { ok: false, status: 409, error: 'PRODUCT_UNAVAILABLE', message: 'This product is no longer available.' };
  }
  return CHECK_FAILED;
}

/** Give the units back — for a hold whose payment never started. Best effort:
 *  commerce releases an unpaid hold on its own after the TTL anyway. */
export async function releaseHold(
  orderId: string,
  gateway: string,
  headers: Record<string, string>,
  reason: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(`${gateway}/api/commerce/orders/${encodeURIComponent(orderId)}/cancel`, {
      method:  'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ reason }),
      cache:   'no-store',
      signal:  AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
