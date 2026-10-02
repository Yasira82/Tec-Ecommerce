// Server-only. Is this purchase still possible — BEFORE the buyer pays?
//
// Why this exists (2026-10-02): the Cap read OUT OF STOCK in Commerce, and
// Ecommerce took a 12π payment for it anyway. Commerce does check stock — but
// only when the ORDER is created, which this app does after Pi has already
// moved the money. So an out-of-stock purchase ended paid, with the order
// refused and no one told: the buy screen ignores the order call's answer.
//
// The rule now: the payment record is not created until commerce-service, the
// owner of products and stock (C-47 — Order/Product owned by commerce), says
// every line is ACTIVE, in stock, and priced at what the buyer is about to pay.
// Anything it cannot confirm is a refusal (P6) — a payment we cannot fulfil is
// worse than a sale we did not make.
//
// It is a pre-check, not a reservation: two buyers can still race for the last
// unit, and commerce-service's own check at order time stays the final word.

export interface PurchaseLine { productId: string; qty: number; }

export type PurchaseCheck =
  | { ok: true; total: number }
  | { ok: false; status: number; error: 'PRODUCT_UNAVAILABLE' | 'OUT_OF_STOCK' | 'PRICE_CHANGED' | 'CHECK_FAILED'; message: string };

interface ProductRow { id?: string; title?: string; price?: unknown; stock?: unknown; status?: unknown }

/** The lines a payment-create body describes — a single product, or a cart's items. */
export function linesFrom(metadata: Record<string, unknown>): PurchaseLine[] | null {
  const items = metadata.items;
  if (Array.isArray(items) && items.length > 0) {
    const lines = items.map((raw) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      return { productId: String(r.productId ?? r.product_id ?? ''), qty: Number(r.qty ?? r.quantity ?? 1) };
    });
    return lines.every((l) => l.productId && Number.isInteger(l.qty) && l.qty >= 1) ? lines : null;
  }
  const id = metadata.product_id;
  if (typeof id === 'string' && id && id !== 'cart_checkout') return [{ productId: id, qty: 1 }];
  return null;
}

/** π amounts compared to the 8 decimals they are stored with (DECIMAL(20,8)). */
const samePi = (a: number, b: number) => Math.abs(a - b) < 1e-8;

export async function checkPurchase(
  lines: PurchaseLine[],
  amount: number,
  gateway: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<PurchaseCheck> {
  let total = 0;
  // The same product on two lines is one stock count.
  const wanted = new Map<string, number>();
  for (const l of lines) wanted.set(l.productId, (wanted.get(l.productId) ?? 0) + l.qty);

  for (const [productId, qty] of wanted) {
    let product: ProductRow | undefined;
    try {
      const res = await fetchImpl(`${gateway}/api/commerce/products/${encodeURIComponent(productId)}`, {
        headers, cache: 'no-store', signal: AbortSignal.timeout(8_000),
      });
      if (res.status === 404) {
        return { ok: false, status: 409, error: 'PRODUCT_UNAVAILABLE', message: 'This product is no longer available.' };
      }
      if (!res.ok) throw new Error(`gateway ${res.status}`);
      const body = await res.json().catch(() => null) as { data?: { product?: ProductRow } } | null;
      product = body?.data?.product;
    } catch {
      return { ok: false, status: 503, error: 'CHECK_FAILED', message: 'Could not confirm this product right now — nothing was charged. Please try again.' };
    }
    if (!product) {
      return { ok: false, status: 503, error: 'CHECK_FAILED', message: 'Could not confirm this product right now — nothing was charged. Please try again.' };
    }
    if (product.status !== 'ACTIVE') {
      return { ok: false, status: 409, error: 'PRODUCT_UNAVAILABLE', message: `${product.title ?? 'This product'} is no longer available.` };
    }
    const stock = Number(product.stock);
    if (!Number.isFinite(stock) || stock < qty) {
      return { ok: false, status: 409, error: 'OUT_OF_STOCK', message: `${product.title ?? 'This product'} is out of stock.` };
    }
    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, status: 503, error: 'CHECK_FAILED', message: 'Could not confirm this product right now — nothing was charged. Please try again.' };
    }
    total += price * qty;
  }

  if (!samePi(total, amount)) {
    return { ok: false, status: 409, error: 'PRICE_CHANGED', message: 'The price has changed — please refresh and try again.' };
  }
  return { ok: true, total };
}
