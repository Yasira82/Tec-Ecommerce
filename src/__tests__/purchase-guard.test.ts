/**
 * No payment for something that cannot be delivered (2026-10-02: the Cap read
 * OUT OF STOCK in Commerce and Ecommerce still took 12π for it — commerce
 * refused the ORDER, after Pi had moved the money).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkPurchase, linesFrom } from '@/lib/purchase-guard';

const product = (over: Record<string, unknown> = {}) => ({
  id: 'p1', title: 'Cap', price: '12.00000000', stock: 3, status: 'ACTIVE', ...over,
});
const answer = (p: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => ({ success: true, data: { product: p } }) }) as Response;

describe('linesFrom', () => {
  it('reads a single product', () => {
    expect(linesFrom({ product_id: 'p1' })).toEqual([{ productId: 'p1', qty: 1 }]);
  });
  it('reads a cart', () => {
    expect(linesFrom({ product_id: 'cart_checkout', items: [{ productId: 'a', qty: 2 }, { product_id: 'b', quantity: 1 }] }))
      .toEqual([{ productId: 'a', qty: 2 }, { productId: 'b', qty: 1 }]);
  });
  it('refuses a cart that names no items, and a bad quantity', () => {
    expect(linesFrom({ product_id: 'cart_checkout' })).toBeNull();
    expect(linesFrom({ items: [{ productId: 'a', qty: 0 }] })).toBeNull();
    expect(linesFrom({})).toBeNull();
  });
});

describe('checkPurchase', () => {
  let fetchImpl: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchImpl = vi.fn(); });
  const run = (lines = [{ productId: 'p1', qty: 1 }], amount = 12) =>
    checkPurchase(lines, amount, 'https://gw', {}, fetchImpl as unknown as typeof fetch);

  it('passes an active, in-stock product at the shown price', async () => {
    fetchImpl.mockResolvedValue(answer(product()));
    expect(await run()).toEqual({ ok: true, total: 12 });
    expect(fetchImpl).toHaveBeenCalledWith('https://gw/api/commerce/products/p1', expect.anything());
  });

  it('refuses an OUT-OF-STOCK product before any payment exists (the Cap)', async () => {
    fetchImpl.mockResolvedValue(answer(product({ stock: 0 })));
    expect(await run()).toMatchObject({ ok: false, status: 409, error: 'OUT_OF_STOCK' });
  });

  it('counts the same product on two cart lines against ONE stock', async () => {
    fetchImpl.mockResolvedValue(answer(product({ stock: 2 })));
    const r = await run([{ productId: 'p1', qty: 2 }, { productId: 'p1', qty: 1 }], 36);
    expect(r).toMatchObject({ ok: false, error: 'OUT_OF_STOCK' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuses an inactive or missing product', async () => {
    fetchImpl.mockResolvedValue(answer(product({ status: 'INACTIVE' })));
    expect(await run()).toMatchObject({ ok: false, error: 'PRODUCT_UNAVAILABLE' });
    fetchImpl.mockResolvedValue(answer(null, 404));
    expect(await run()).toMatchObject({ ok: false, error: 'PRODUCT_UNAVAILABLE' });
  });

  it('refuses an amount that is not the price — a client cannot pay 1π for 580π', async () => {
    fetchImpl.mockResolvedValue(answer(product({ price: '580' })));
    expect(await run(undefined, 1)).toMatchObject({ ok: false, status: 409, error: 'PRICE_CHANGED' });
  });

  it('fails CLOSED when commerce cannot be asked (P6)', async () => {
    fetchImpl.mockRejectedValue(new Error('down'));
    expect(await run()).toMatchObject({ ok: false, status: 503, error: 'CHECK_FAILED' });
    fetchImpl.mockResolvedValue(answer(product(), 500));
    expect(await run()).toMatchObject({ ok: false, status: 503, error: 'CHECK_FAILED' });
  });
});
