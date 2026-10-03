/**
 * 3 Oct 2026, from the owner's phone:
 *  · /orders went black — commerce sends DECIMAL totals as strings and the page
 *    called .toFixed on one;
 *  · a cancelled charger stayed "Out of stock" — the hold was not released;
 *  · every store page read "Merchant not found · Products (0)".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { normalizeOrder, ordersToShow } from '@/lib-client/orders/normalize';

// The row commerce-service actually returns (Prisma, Decimal → string).
const commerceRow = (over: Record<string, unknown> = {}) => ({
  id: '11111111-2222-4333-8444-555555555555', buyer_id: 'u1', status: 'PAID',
  total: '25.00000000', currency: 'PI', payment_id: 'pay-1', paid_at: '2026-10-03T16:00:00Z',
  created_at: '2026-10-03T16:00:00Z', notes: null,
  items: [{ id: 'i1', product_id: 'p1', quantity: 1, price: '25.00000000', snapshot: { title: 'Charger 45W' } }],
  ...over,
});

describe('My Orders reads what commerce sends', () => {
  it('turns DECIMAL strings into numbers — the crash', () => {
    const o = normalizeOrder(commerceRow())!;
    expect(o.total).toBe(25);
    expect(() => o.total.toFixed(2)).not.toThrow();
    expect(o.items[0]).toEqual({ productId: 'p1', qty: 1, price: 25, title: 'Charger 45W' });
  });

  it('lowercases the status, and maps PROCESSING / DELIVERED onto the page\'s steps', () => {
    expect(normalizeOrder(commerceRow())!.status).toBe('paid');
    expect(normalizeOrder(commerceRow({ status: 'PROCESSING' }))!.status).toBe('paid');
    expect(normalizeOrder(commerceRow({ status: 'DELIVERED' }))!.status).toBe('completed');
  });

  it('does not list a checkout the buyer walked away from (released hold)', () => {
    const list = ordersToShow([
      commerceRow(),
      commerceRow({ id: 'a', status: 'CANCELLED', paid_at: null, payment_id: null }),
      commerceRow({ id: 'b', status: 'PENDING', paid_at: null }),
    ]);
    expect(list.map((o) => o.status)).toEqual(['paid', 'pending']);
  });

  it('survives junk instead of crashing the page', () => {
    expect(ordersToShow(null)).toEqual([]);
    expect(ordersToShow([{}, null, commerceRow({ total: 'x', items: null })])).toHaveLength(1);
  });
});

describe('back from the Hub: the hold is settled', () => {
  beforeEach(() => { sessionStorage.clear(); vi.resetModules(); });
  const ORDER = '11111111-2222-4333-8444-555555555555';

  it('a Cancel at the Hub (no status) releases the hold', async () => {
    const { rememberHubHold, settleHubHoldOnReturn } = await import('@/lib-client/orders/hub-hold');
    rememberHubHold(ORDER);
    const f = vi.fn(async () => ({ ok: true }) as Response);
    expect(await settleHubHoldOnReturn('', f)).toBe('released');
    expect(String(f.mock.calls[0][0])).toBe(`/api/bff/orders/${ORDER}/cancel`);
    expect(sessionStorage.getItem('tec_hub_hold')).toBeNull();
  });

  it('a success confirms the hold with the Hub\'s payment id', async () => {
    const { rememberHubHold, settleHubHoldOnReturn } = await import('@/lib-client/orders/hub-hold');
    rememberHubHold(ORDER);
    const f = vi.fn(async () => ({ ok: true }) as Response);
    expect(await settleHubHoldOnReturn('?payment_status=success&payment_id=pay-9&txid=t', f)).toBe('confirmed');
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)))
      .toEqual({ order_id: ORDER, payment_id: 'pay-9' });
  });

  it('does nothing when this tab sent nothing to the Hub', async () => {
    const { settleHubHoldOnReturn } = await import('@/lib-client/orders/hub-hold');
    const f = vi.fn();
    expect(await settleHubHoldOnReturn('', f as unknown as typeof fetch)).toBe('none');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('a store page is the seller\'s own products', () => {
  const SELLER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  beforeEach(() => { vi.resetModules(); process.env.API_GATEWAY_URL = 'https://gw'; });

  it('shows the seller\'s products only — even from a commerce that ignores ?seller=', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ data: { products: [
        { id: 'p1', seller_id: SELLER, price: '5.00000000', title: 'Cable' },
        { id: 'p2', seller_id: 'someone-else', price: '9', title: 'Other' },
      ] } }),
    })));
    const { GET } = await import('@/app/api/bff/store/[id]/route');
    const res = await GET(new NextRequest(`https://x/api/bff/store/${SELLER}`), { params: Promise.resolve({ id: SELLER }) });
    const body = await res.json();
    expect(body.products.map((p: { id: string }) => p.id)).toEqual(['p1']);
    expect(body.products[0].price).toBe(5);
    expect(body.merchant).toMatchObject({ display_name: 'TEC Store', products_count: 1 });
    vi.unstubAllGlobals();
  });

  it('refuses an id that is not a seller id, without calling the gateway', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/store/[id]/route');
    const res = await GET(new NextRequest('https://x/api/bff/store/x'), { params: Promise.resolve({ id: '../orders' }) });
    expect(await res.json()).toEqual({ merchant: null, products: [] });
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
