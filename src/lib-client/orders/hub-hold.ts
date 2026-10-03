// Mode 1: the buyer pays at the Hub, and comes back here either way.
//
// Before the redirect the app holds the units (holdForHub) and remembers the
// hold for THIS tab. On the way back:
//   · `payment_status=success&payment_id=…` → confirm the hold (commerce checks
//     the payment with payment-service; the payment's own event would settle it
//     anyway — this only makes the order appear now);
//   · anything else — the Hub's Cancel returns with NO status at all, an error
//     with `payment_status=error` → release the hold now, instead of leaving the
//     unit "out of stock" for the whole TTL (3 Oct 2026: a cancelled charger).
// Release is conditional in commerce: a hold that was paid meanwhile stays paid.

const KEY = 'tec_hub_hold';
/** Older than this, the hold has been released by commerce's own sweep. */
const MAX_AGE_MS = 2 * 60 * 60_000;

const getCsrfToken = () =>
  typeof document === 'undefined' ? '' :
  document.cookie.match(/(?:^|;\s*)tec_csrf=([^;]*)/)?.[1] ?? '';

export function rememberHubHold(orderId: string): void {
  try { sessionStorage.setItem(KEY, JSON.stringify({ orderId, at: Date.now() })); } catch { /* the TTL still releases it */ }
}

export function forgetHubHold(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing to forget */ }
}

function readHubHold(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { orderId?: unknown; at?: unknown };
    if (typeof v.orderId !== 'string' || typeof v.at !== 'number' || Date.now() - v.at > MAX_AGE_MS) return null;
    return v.orderId;
  } catch { return null; }
}

/** Settle the hold this tab sent to the Hub, from the URL it came back on.
 *  Answers what was done — for tests and logs. */
export async function settleHubHoldOnReturn(
  search: string,
  fetchImpl: typeof fetch = fetch,
): Promise<'none' | 'confirmed' | 'released'> {
  const orderId = readHubHold();
  if (!orderId) { forgetHubHold(); return 'none'; }

  const p = new URLSearchParams(search);
  // Still on the way out (the redirect has not happened yet) — nothing to do.
  if (p.get('pay') === '1') return 'none';
  forgetHubHold();

  const headers = { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() };
  const paymentId = p.get('payment_id');
  try {
    if (p.get('payment_status') === 'success' && paymentId) {
      await fetchImpl('/api/bff/orders', {
        method: 'POST', credentials: 'include', headers,
        body: JSON.stringify({ order_id: orderId, payment_id: paymentId }),
      });
      return 'confirmed';
    }
    await fetchImpl(`/api/bff/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'PATCH', credentials: 'include', headers,
    });
    return 'released';
  } catch {
    return 'none';
  }
}
