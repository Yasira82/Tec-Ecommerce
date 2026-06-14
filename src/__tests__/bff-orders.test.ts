// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const GW = 'https://api.example.com';

const makeReq = (opts: {
  method?:  string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  body?:    unknown;
  url?:     string;
}) => {
  const cookieStr = opts.cookies
    ? Object.entries(opts.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
    : '';
  const headers: Record<string, string> = {};
  if (cookieStr) headers['Cookie'] = cookieStr;
  if (opts.headers) Object.assign(headers, opts.headers);
  return new NextRequest(opts.url ?? 'http://localhost/api/bff/orders', {
    method:  opts.method ?? 'GET',
    headers,
    body:    opts.body ? JSON.stringify(opts.body) : undefined,
  });
};

const CSRF_TOKEN = 'test-csrf-token';
const csrfCookies = { tec_csrf: CSRF_TOKEN };
const csrfHeaders = { 'x-csrf-token': CSRF_TOKEN };

const userCookie = JSON.stringify({ id: 'user-123', piId: 'pi-456' });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_GATEWAY_URL = GW;
});

// ── GET /api/bff/orders ─────────────────────────────────────────
describe('GET /api/bff/orders', () => {
  it('returns 401 when tec_user cookie missing', async () => {
    const { GET } = await import('@/app/api/bff/orders/route');
    const res = await GET(makeReq({ method: 'GET' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns orders on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ orders: [{ id: 'order-1' }] }),
    } as Response);

    const { GET } = await import('@/app/api/bff/orders/route');
    const res = await GET(makeReq({
      cookies: { tec_user: userCookie, tec_access_token: 'tok-123' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(1);
  });

  it('forwards gateway error status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false, status: 503,
      json: async () => ({ error: 'Service unavailable' }),
    } as Response);

    const { GET } = await import('@/app/api/bff/orders/route');
    const res = await GET(makeReq({
      cookies: { tec_user: userCookie, tec_access_token: 'tok-123' },
    }));
    expect(res.status).toBe(503);
  });

  it('returns 500 on fetch exception', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const { GET } = await import('@/app/api/bff/orders/route');
    const res = await GET(makeReq({
      cookies: { tec_user: userCookie, tec_access_token: 'tok-123' },
    }));
    expect(res.status).toBe(500);
  });
});

// ── POST /api/bff/orders ────────────────────────────────────────
describe('POST /api/bff/orders', () => {
  it('returns 403 when CSRF token missing', async () => {
    const { POST } = await import('@/app/api/bff/orders/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_user: userCookie },
      body:    { payment_id: 'pay-1', product_id: 'prod-1' },
      // no tec_csrf cookie, no x-csrf-token header
    }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('CSRF validation failed');
  });

  it('returns 401 when tec_user cookie missing', async () => {
    const { POST } = await import('@/app/api/bff/orders/route');
    const res = await POST(makeReq({
      method:   'POST',
      cookies:  { ...csrfCookies },
      headers:  csrfHeaders,
      body:     { payment_id: 'pay-1', product_id: 'prod-1' },
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when payment_id missing', async () => {
    const { POST } = await import('@/app/api/bff/orders/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_user: userCookie, ...csrfCookies },
      headers: csrfHeaders,
      body:    { product_id: 'prod-1' },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when both product_id and items missing', async () => {
    const { POST } = await import('@/app/api/bff/orders/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_user: userCookie, ...csrfCookies },
      headers: csrfHeaders,
      body:    { payment_id: 'pay-1' },
    }));
    expect(res.status).toBe(400);
  });

  it('creates single-product order with product_id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 201,
      json: async () => ({ order: { id: 'ord-1' } }),
    } as Response);

    const { POST } = await import('@/app/api/bff/orders/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_user: userCookie, tec_access_token: 'tok-123', ...csrfCookies },
      headers: csrfHeaders,
      body:    { payment_id: 'pay-1', product_id: 'prod-abc' },
    }));
    expect(res.status).toBe(200);

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sent = JSON.parse(init.body);
    expect(sent.items).toEqual([{ productId: 'prod-abc', qty: 1 }]);
    expect(sent.payment_id).toBe('pay-1');
  });

  it('creates multi-item order with items[]', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 201,
      json: async () => ({ order: { id: 'ord-2' } }),
    } as Response);

    const { POST } = await import('@/app/api/bff/orders/route');
    const items = [{ productId: 'prod-1', qty: 2 }, { productId: 'prod-2', qty: 1 }];
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_user: userCookie, tec_access_token: 'tok-123', ...csrfCookies },
      headers: csrfHeaders,
      body:    { payment_id: 'pay-2', items },
    }));
    expect(res.status).toBe(200);

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sent = JSON.parse(init.body);
    expect(sent.items).toEqual(items);
  });

  it('items[] takes precedence over product_id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 201,
      json: async () => ({}),
    } as Response);

    const { POST } = await import('@/app/api/bff/orders/route');
    const items = [{ productId: 'prod-cart', qty: 3 }];
    await POST(makeReq({
      method:  'POST',
      cookies: { tec_user: userCookie, tec_access_token: 'tok-123', ...csrfCookies },
      headers: csrfHeaders,
      body:    { payment_id: 'pay-3', product_id: 'prod-single', items },
    }));

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sent = JSON.parse(init.body);
    expect(sent.items).toEqual(items);
  });

  it('returns 500 on fetch exception', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Gateway down'));

    const { POST } = await import('@/app/api/bff/orders/route');
    const res = await POST(makeReq({
      method:  'POST',
      cookies: { tec_user: userCookie, tec_access_token: 'tok-123', ...csrfCookies },
      headers: csrfHeaders,
      body:    { payment_id: 'pay-4', product_id: 'prod-1' },
    }));
    expect(res.status).toBe(500);
  });

  it('userId comes from cookie not from request body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 201,
      json: async () => ({}),
    } as Response);

    const { POST } = await import('@/app/api/bff/orders/route');
    await POST(makeReq({
      method:  'POST',
      cookies: { tec_user: userCookie, tec_access_token: 'tok-123', ...csrfCookies },
      headers: csrfHeaders,
      body:    { payment_id: 'pay-5', product_id: 'prod-1', userId: 'spoofed-id' },
    }));

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-user-id']).toBe('user-123');
    expect(headers['x-user-id']).not.toBe('spoofed-id');
  });
});
