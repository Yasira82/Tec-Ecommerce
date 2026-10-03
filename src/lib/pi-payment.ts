import { rememberHubHold } from '@/lib-client/orders/hub-hold';

const getCsrfToken = (): string =>
  typeof document === 'undefined' ? '' :
  document.cookie.match(/(?:^|;\s*)tec_csrf=([^;]*)/)?.[1] ?? '';

const getToken = (): string | null =>
  typeof document === 'undefined' ? null :
  document.cookie.match(/(?:^|;\s*)tec_access_token=([^;]*)/)?.[1] ?? null;

export interface PaymentResult {
  status:     'completed' | 'cancelled' | 'error';
  success:    boolean;
  paymentId?: string;
  txid?:      string;
  message?:   string;
}

/**
 * Why the last `createPaymentRecord` returned null, when the server said why —
 * "out of stock", "no longer available", "price changed" (lib/purchase-guard.ts).
 * Read once; null when there was no refusal to report.
 */
let lastRefusal: string | null = null;
export const takePaymentRecordRefusal = (): string | null => {
  const r = lastRefusal; lastRefusal = null; return r;
};

/**
 * The order each payment record reserved (payment-id → order-id). The server
 * holds the units BEFORE Pi opens (lib/order-hold.ts) and names the hold in the
 * answer; the buy screen then confirms THAT order after paying, or releases it
 * when the buyer cancels — instead of creating an order after the money moved.
 */
const heldOrders = new Map<string, string>();
export const heldOrderFor = (paymentId: string): string | undefined => heldOrders.get(paymentId);

/** The payment did not complete here (Cancel, error, timeout): put the reserved
 *  units back on sale now. Conditional in commerce — a hold the payment's event
 *  already marked PAID stays paid, and a payment that lands later reopens it. */
export const releaseHeldOrder = async (paymentId: string): Promise<void> => {
  const orderId = heldOrders.get(paymentId);
  if (!orderId) return;
  heldOrders.delete(paymentId);
  try {
    await fetch(`/api/bff/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
    });
  } catch { /* commerce releases an unpaid hold on its own after the TTL */ }
};

/**
 * After a completed Pi payment: settle the order it paid for. With a hold, that
 * is a CONFIRM of the reserved order; without one (older server), the order is
 * created as before. The payment's own event settles a held order even if this
 * call never arrives.
 */
export const recordPaidOrder = async (
  paymentId: string,
  order: { product_id?: string; items?: { productId: string; qty: number }[]; memo?: string },
): Promise<void> => {
  const order_id = heldOrders.get(paymentId);
  try {
    await fetch('/api/bff/orders', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
      body: JSON.stringify({ ...order, payment_id: paymentId, ...(order_id && { order_id }) }),
    });
  } catch { /* the payment's event settles a held order */ }
  heldOrders.delete(paymentId);
};

/**
 * Mode 1 (paying at the Hub): reserve first, so the Hub is never asked to take
 * π for a unit someone else already has. Answers the order to carry to the Hub
 * (null when the server has no holds yet, or the buyer has no session here — the
 * Hub flow then runs as before), or the reason it was refused.
 */
export const holdForHub = async (
  amount: number,
  order: { product_id?: string; items?: { productId: string; qty: number }[] },
): Promise<{ orderId: string | null } | { refusal: string }> => {
  try {
    const res = await fetch('/api/bff/orders/hold', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
      body: JSON.stringify({ amount, ...order }),
    });
    const body = await res.json().catch(() => null) as { message?: unknown; data?: { order_id?: unknown } } | null;
    // Out of stock / gone / price changed (409), or stock could not be confirmed
    // (503): no π is asked for. A missing session here (401) is not a refusal —
    // the Hub has its own, and the flow runs as it always has.
    if (res.status === 409 || res.status === 503) {
      return { refusal: typeof body?.message === 'string' ? body.message : 'This product is not available right now.' };
    }
    const id = body?.data?.order_id;
    const orderId = res.ok && typeof id === 'string' ? id : null;
    // Released on the way back if the buyer cancels at the Hub (HubHoldReturn).
    if (orderId) rememberHubHold(orderId);
    return { orderId };
  } catch {
    return { orderId: null };
  }
};

export const createPaymentRecord = async (
  amount: number, productId: string, memo: string,
  items?: { productId: string; qty: number }[],
): Promise<string | null> => {
  lastRefusal = null;
  try {
    const token = getToken();
    if (!token) return null;
    const res = await fetch('/api/bff/payment/create', {
      method: 'POST', credentials: 'include',
      headers: {
        'Content-Type':  'application/json',
        'x-csrf-token':  getCsrfToken(),
        Authorization:   `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount,
        memo,
        // The server checks every line against commerce-service before any π
        // moves, so a cart names its items here — not only at order time.
        metadata: { source: 'ecommerce', product_id: productId, ...(items && { items }) },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { message?: unknown } | null;
      if (res.status === 409 || res.status === 503) {
        lastRefusal = typeof body?.message === 'string' ? body.message : null;
      }
      return null;
    }
    const data = await res.json();
    const id: string | null = data?.data?.payment?.id ?? data?.data?.id ?? data?.id ?? null;
    if (id && typeof data?.order_id === 'string') heldOrders.set(id, data.order_id);
    return id;
  } catch { return null; }
};

export const createU2APayment = async (
  amount:     number,
  memo:       string,
  metadata:   Record<string, unknown>,
  internalId: string,
): Promise<PaymentResult> => {
  return new Promise(async (resolve) => {
    if (!window.Pi) {
      resolve({ status: 'error', success: false, message: 'Pi SDK not ready' });
      return;
    }

    if ((window as any).__TEC_PI_FOREIGN_SESSION) {
      resolve({ status: 'error', success: false, message: 'foreign_session' });
      return;
    }

    let settled = false;
    const done = (result: PaymentResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      done({ status: 'error', success: false, message: 'Payment timed out — please try again.' });
    }, 90_000);

    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type':  'application/json',
      'x-csrf-token':  getCsrfToken(),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      await window.Pi.authenticate(
        ['username', 'payments'],
        async (incomplete: unknown) => {
          const pid = (incomplete as { identifier?: string } | null)?.identifier;
          if (!pid) return;
          try {
            await fetch('/api/bff/payment/resolve-incomplete', {
              method: 'POST', credentials: 'include',
              headers, body: JSON.stringify({ pi_payment_id: pid }),
            });
          } catch {}
        },
      );
    } catch (authErr) {
      done({
        status:  'error',
        success: false,
        message: 'Pi auth failed: ' + (authErr instanceof Error ? authErr.message : String(authErr)),
      });
      return;
    }

    try {
      window.Pi.createPayment(
        { amount, memo, metadata: { ...metadata, internalId } },
        {
          onReadyForServerApproval: async (piPaymentId: string) => {
            try {
              const res = await fetch('/api/bff/payment/approve', {
                method: 'POST', credentials: 'include', headers,
                body: JSON.stringify({ payment_id: internalId, pi_payment_id: piPaymentId }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                done({ status: 'error', success: false, message: (err as Record<string, unknown>)?.error as string ?? 'Approve failed' });
              }
            } catch (err) {
              done({ status: 'error', success: false, message: String(err) });
            }
          },
          onReadyForServerCompletion: async (piPaymentId: string, txid: string) => {
            try {
              const res  = await fetch('/api/bff/payment/complete', {
                method: 'POST', credentials: 'include', headers,
                body: JSON.stringify({ payment_id: internalId, transaction_id: txid, pi_payment_id: piPaymentId }),
              });
              const data = await res.json().catch(() => ({}));
              done(res.ok
                ? { status: 'completed', success: true, paymentId: internalId, txid }
                : { status: 'error', success: false, message: (data as Record<string, unknown>)?.error as string ?? 'Complete failed' });
            } catch (err) {
              done({ status: 'error', success: false, message: String(err) });
            }
          },
          onCancel: () => done({ status: 'cancelled', success: false }),
          // The SDK is not guaranteed to hand back a real Error — reading
          // `.message` off `undefined` would throw INSIDE the callback, where
          // nothing catches it, and the payment would hang to the timeout with
          // no message at all.
          onError:  (err?: unknown) => done({
            status: 'error', success: false,
            message: err instanceof Error ? err.message : (err ? String(err) : 'Pi reported an error with no detail.'),
          }),
        },
      );
    } catch (err) {
      done({
        status:  'error',
        success: false,
        message: err instanceof Error ? err.message : 'Pi payment error — please try again.',
      });
    }
  });
};
