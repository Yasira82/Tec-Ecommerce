// @vitest-environment node
/**
 * The held order after payment: confirmed (never re-created), "not confirmed
 * yet" is pending rather than failed, Mode 1 holds before the Hub, and a
 * cancelled payment gives the units back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.stubEnv('API_GATEWAY_URL', 'https://gw');

const ORDER = '11111111-2222-4333-8444-555555555555';
const user  = encodeURIComponent(JSON.stringify({ id: 'u1' }));
const req = (url: string, method: string, body?: unknown) => {
  const r = new NextRequest(`https://ecommerce.tecosystem.app${url}`, {
    method, headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  r.cookies.set('tec_access_token', 'tok');
  r.cookies.set('tec_user', user);
  return r;
};
const answer = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

let fetchMock: ReturnType<typeof vi.fn>;
let routes: Record<string, ReturnType<typeof answer>>;
beforeEach(() => {
  vi.resetModules();
  routes = {};
  fetchMock = vi.fn(async (url: string) => {
    const hit = Object.keys(routes).find((k) => String(url).includes(k));
    return hit ? routes[hit] : answer(500, {});
  });
  vi.stubGlobal('fetch', fetchMock);
});
const calls = (part: string) => fetchMock.mock.calls.filter((c) => String(c[0]).includes(part));

describe('POST /api/bff/orders with order_id — confirm the hold', () => {
  it('confirms the held order and creates none', async () => {
    routes[`/orders/${ORDER}/confirm`] = answer(200, { success: true, data: { outcome: 'paid' } });
    const { POST } = await import('@/app/api/bff/orders/route');
    const res = await POST(req('/api/bff/orders', 'POST', { product_id: 'p1', payment_id: 'pay-1', order_id: ORDER }));
    expect(res.status).toBe(200);
    expect(JSON.parse(String(calls('/confirm')[0][1].body))).toEqual({ payment_id: 'pay-1' });
    expect(calls('/api/commerce/orders').filter((c) => String(c[0]).endsWith('/api/commerce/orders'))).toHaveLength(0);
  });

  it('"not confirmed yet" (503) is pending — the payment event settles it', async () => {
    routes[`/orders/${ORDER}/confirm`] = answer(503, { message: 'Payment not confirmed yet' });
    const { POST } = await import('@/app/api/bff/orders/route');
    const res = await POST(req('/api/bff/orders', 'POST', { payment_id: 'pay-1', order_id: ORDER }));
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ data: { pending: true, order_id: ORDER } });
  });

  it('a refund owed is passed through, not hidden', async () => {
    routes[`/orders/${ORDER}/confirm`] = answer(409, { code: 'REFUND_OWED', message: 'sold out' });
    const { POST } = await import('@/app/api/bff/orders/route');
    const res = await POST(req('/api/bff/orders', 'POST', { payment_id: 'pay-1', order_id: ORDER }));
    expect(res.status).toBe(409);
  });

  it('without order_id, the order is created as before (older clients)', async () => {
    routes['/api/commerce/orders'] = answer(201, { success: true });
    const { POST } = await import('@/app/api/bff/orders/route');
    const res = await POST(req('/api/bff/orders', 'POST', { product_id: 'p1', payment_id: 'pay-1' }));
    expect(res.status).toBe(200);
    expect(calls('/confirm')).toHaveLength(0);
  });
});

describe('POST /api/bff/orders/hold — Mode 1 reserves before the Hub', () => {
  const product = (stock: number) => answer(200, { data: { product: { id: 'p1', title: 'Cap', price: '12', stock, status: 'ACTIVE' } } });

  it('answers the order the Hub payment will carry', async () => {
    routes['/api/commerce/products/'] = product(1);
    routes['/api/commerce/orders/hold'] = answer(201, { data: { order: { id: ORDER } } });
    const { POST } = await import('@/app/api/bff/orders/hold/route');
    const res = await POST(req('/api/bff/orders/hold', 'POST', { amount: 12, product_id: 'p1' }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ data: { order_id: ORDER } });
  });

  it('a sold-out last unit is refused before the buyer leaves for the Hub', async () => {
    routes['/api/commerce/products/'] = product(1);
    routes['/api/commerce/orders/hold'] = answer(400, { message: 'Insufficient stock for: Cap' });
    const { POST } = await import('@/app/api/bff/orders/hold/route');
    const res = await POST(req('/api/bff/orders/hold', 'POST', { amount: 12, product_id: 'p1' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'OUT_OF_STOCK' });
  });

  it('holds every line of a cart', async () => {
    routes['/api/commerce/products/'] = product(5);
    routes['/api/commerce/orders/hold'] = answer(201, { data: { order: { id: ORDER } } });
    const { POST } = await import('@/app/api/bff/orders/hold/route');
    const res = await POST(req('/api/bff/orders/hold', 'POST', { amount: 24, product_id: 'cart_checkout', items: [{ productId: 'p1', qty: 2 }] }));
    expect(res.status).toBe(201);
    expect(JSON.parse(String(calls('/orders/hold')[0][1].body))).toEqual({ items: [{ product_id: 'p1', quantity: 2 }] });
  });
});

describe('PATCH /api/bff/orders/:id/cancel — a cancelled payment releases the hold', () => {
  it('asks commerce to cancel that order', async () => {
    routes[`/orders/${ORDER}/cancel`] = answer(200, { success: true });
    const { PATCH } = await import('@/app/api/bff/orders/[id]/cancel/route');
    const res = await PATCH(req(`/api/bff/orders/${ORDER}/cancel`, 'PATCH'), { params: Promise.resolve({ id: ORDER }) });
    expect(res.status).toBe(200);
    expect(calls('/cancel')[0][1].method).toBe('PATCH');
  });

  it('refuses an id that is not an order id', async () => {
    const { PATCH } = await import('@/app/api/bff/orders/[id]/cancel/route');
    const res = await PATCH(req('/api/bff/orders/x/cancel', 'PATCH'), { params: Promise.resolve({ id: '../../payment' }) });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
