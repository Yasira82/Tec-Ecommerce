/**
 * POST /api/bff/payment/create asks commerce-service BEFORE creating the
 * payment record — so an out-of-stock purchase never reaches Pi at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.stubEnv('API_GATEWAY_URL', 'https://gw');

const user = encodeURIComponent(JSON.stringify({ id: 'u1' }));
// Cookies through the cookie API: a Request drops a raw `Cookie` header as forbidden.
const req = (body: unknown) => {
  const r = new NextRequest('https://ecommerce.tecosystem.app/api/bff/payment/create', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  r.cookies.set('tec_access_token', 'tok');
  r.cookies.set('tec_user', user);
  return r;
};

const productAnswer = (stock: number) => ({
  ok: true, status: 200,
  json: async () => ({ success: true, data: { product: { id: 'p1', title: 'Cap', price: '12', stock, status: 'ACTIVE' } } }),
});

const HOLD_ID = '11111111-2222-4333-8444-555555555555';
const holdAnswer = {
  ok: true, status: 201,
  json: async () => ({ success: true, data: { order: { id: HOLD_ID, status: 'PENDING' } } }),
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  (globalThis as any).__hold = undefined;
  fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes('/api/commerce/products/')) return productAnswer(Number((globalThis as any).__stock ?? 3));
    if (String(url).includes('/api/commerce/orders/hold')) return (globalThis as any).__hold ?? holdAnswer;
    if (String(url).includes('/cancel')) return { ok: true, status: 200, json: async () => ({ success: true }) };
    return { ok: true, status: 201, json: async () => ({ data: { payment: { id: 'pay-1' } } }) };
  });
  vi.stubGlobal('fetch', fetchMock);
});

const paymentCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/payment/create'));
const holdCalls    = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/commerce/orders/hold'));
const cancelCalls  = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes('/cancel'));
const sentMetadata = () => JSON.parse(String(paymentCalls()[0][1].body)).metadata;

describe('payment create — stock is checked before any π moves', () => {
  it('creates the record when the product is in stock at that price', async () => {
    (globalThis as any).__stock = 3;
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req({ amount: 12, metadata: { source: 'ecommerce', product_id: 'p1' } }));
    expect(res.status).toBe(201);
    expect(paymentCalls()).toHaveLength(1);
  });

  it('refuses an out-of-stock product with 409, and never calls payment-service', async () => {
    (globalThis as any).__stock = 0;
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req({ amount: 12, metadata: { source: 'ecommerce', product_id: 'p1' } }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'OUT_OF_STOCK' });
    expect(paymentCalls()).toHaveLength(0);
  });

  it('refuses a payment that names no product', async () => {
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req({ amount: 12, metadata: { source: 'ecommerce', product_id: 'cart_checkout' } }));
    expect(res.status).toBe(400);
    expect(paymentCalls()).toHaveLength(0);
  });
});

describe('payment create — the last unit is HELD before any π moves', () => {
  it('holds the units, names the hold in the payment, and answers its order_id', async () => {
    (globalThis as any).__stock = 1;
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req({ amount: 12, metadata: { source: 'ecommerce', product_id: 'p1' } }));
    expect(res.status).toBe(201);
    expect(holdCalls()).toHaveLength(1);
    expect(JSON.parse(String(holdCalls()[0][1].body))).toEqual({ items: [{ product_id: 'p1', quantity: 1 }] });
    expect(sentMetadata().order_id).toBe(HOLD_ID);
    expect(await res.json()).toMatchObject({ order_id: HOLD_ID });
  });

  it('the second buyer of the last unit is refused BEFORE paying (commerce: Insufficient stock)', async () => {
    (globalThis as any).__stock = 1; // the pre-check still says yes — the hold is the word
    (globalThis as any).__hold = {
      ok: false, status: 400,
      json: async () => ({ statusCode: 400, message: 'Insufficient stock for: Cap' }),
    };
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req({ amount: 12, metadata: { source: 'ecommerce', product_id: 'p1' } }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'OUT_OF_STOCK', message: 'Cap is out of stock.' });
    expect(paymentCalls()).toHaveLength(0);
  });

  it('a hold that cannot be placed is a refusal, not a payment without one (P6)', async () => {
    (globalThis as any).__hold = { ok: false, status: 500, json: async () => ({}) };
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req({ amount: 12, metadata: { source: 'ecommerce', product_id: 'p1' } }));
    expect(res.status).toBe(503);
    expect(paymentCalls()).toHaveLength(0);
  });

  it('a backend without holds yet (deploy order) pays as before, with no order_id', async () => {
    (globalThis as any).__hold = {
      ok: false, status: 404,
      json: async () => ({ statusCode: 404, message: 'Cannot POST /commerce/orders/hold' }),
    };
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req({ amount: 12, metadata: { source: 'ecommerce', product_id: 'p1', order_id: 'someone-elses' } }));
    expect(res.status).toBe(201);
    expect(sentMetadata().order_id).toBeUndefined(); // the client's claim was dropped
  });

  it('gives the units back when the payment record cannot be created', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/commerce/products/')) return productAnswer(3);
      if (String(url).includes('/api/commerce/orders/hold')) return holdAnswer;
      if (String(url).includes('/cancel')) return { ok: true, status: 200, json: async () => ({}) };
      return { ok: false, status: 500, json: async () => ({ error: 'boom' }) };
    });
    const { POST } = await import('@/app/api/bff/payment/create/route');
    const res = await POST(req({ amount: 12, metadata: { source: 'ecommerce', product_id: 'p1' } }));
    expect(res.status).toBe(500);
    expect(cancelCalls()).toHaveLength(1);
    expect(String(cancelCalls()[0][0])).toContain(`/api/commerce/orders/${HOLD_ID}/cancel`);
  });
});
