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

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes('/api/commerce/products/')) return productAnswer(Number((globalThis as any).__stock ?? 3));
    return { ok: true, status: 201, json: async () => ({ data: { payment: { id: 'pay-1' } } }) };
  });
  vi.stubGlobal('fetch', fetchMock);
});

const paymentCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/payment/create'));

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
