// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mock refs ─────────────────────────────────────────────────────────
const mockFetch = vi.hoisted(() => vi.fn());
const mockJwtVerify = vi.hoisted(() => vi.fn());

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
}));

// Replace global fetch
vi.stubGlobal('fetch', mockFetch);

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeReq(url: string, opts: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
  const req = new NextRequest(url, {
    method:  opts.method ?? 'GET',
    body:    opts.body,
    headers: opts.headers,
  });
  return req;
}

function makeReqWithCookies(url: string, cookies: Record<string, string>, opts: { method?: string; body?: string } = {}) {
  const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  return makeReq(url, { ...opts, headers: { Cookie: cookieStr } });
}

function mockOkFetch(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok:     status >= 200 && status < 300,
    status,
    json:   async () => body,
  });
}

function mockFailFetch(body: unknown, status: number) {
  mockFetch.mockResolvedValueOnce({
    ok:     false,
    status,
    json:   async () => body,
  });
}

// ── Env setup ─────────────────────────────────────────────────────────────────
beforeAll(() => {
  process.env.API_GATEWAY_URL = 'http://gateway.test';
  process.env.INTERNAL_SECRET = 'test-secret';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.SSO_SECRET = 'test-sso-secret';
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// BFF Products Route
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/bff/products', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ GET } = await import('@/app/api/bff/products/route'));
  });

  it('returns normalized products on success', async () => {
    const rawProducts = [
      {
        id: 'p1', title: 'Product 1', price: 10, seller_id: 'seller-1',
        metadata: { images: ['img1.jpg'], rating: 4.5, reviewCount: 10 },
      },
    ];
    mockOkFetch({ data: { products: rawProducts } });

    const req = makeReqWithCookies('http://localhost/api/bff/products', { tec_access_token: 'tok' });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.products).toHaveLength(1);
    expect(data.data.products[0].images).toEqual(['img1.jpg']);
    expect(data.data.products[0].rating).toBe(4.5);
    expect(data.data.products[0].reviews_count).toBe(10);
  });

  it('handles products at root level (not nested in data)', async () => {
    mockOkFetch({ products: [{ id: 'p2', title: 'P2', price: 5, seller_id: 's2', metadata: {} }] });

    const req = makeReq('http://localhost/api/bff/products');
    const res = await GET(req);
    const data = await res.json();

    expect(data.data.products).toHaveLength(1);
  });

  it('applies image_url fallback when no metadata images', async () => {
    mockOkFetch({ products: [{ id: 'p3', title: 'P3', price: 5, image_url: 'img.jpg', metadata: {} }] });

    const req = makeReq('http://localhost/api/bff/products');
    const res = await GET(req);
    const data = await res.json();

    expect(data.data.products[0].images).toEqual(['img.jpg']);
  });

  it('applies default values when no metadata', async () => {
    mockOkFetch({ products: [{ id: 'p4', title: 'P4', price: 5, metadata: {} }] });

    const req = makeReq('http://localhost/api/bff/products');
    const res = await GET(req);
    const data = await res.json();

    expect(data.data.products[0].rating).toBe(0);
    expect(data.data.products[0].reviews_count).toBe(0);
    expect(data.data.products[0].images).toEqual([]);
  });

  it('proxies category and pagination params', async () => {
    mockOkFetch({ data: { products: [] } });

    const req = makeReq('http://localhost/api/bff/products?category=electronics&page=2&limit=6');
    await GET(req);

    const fetchCall = mockFetch.mock.calls[0][0] as string;
    expect(fetchCall).toContain('category=electronics');
    expect(fetchCall).toContain('offset=6');
    expect(fetchCall).toContain('limit=6');
  });

  it('does not include category=all in params', async () => {
    mockOkFetch({ data: { products: [] } });

    const req = makeReq('http://localhost/api/bff/products?category=all');
    await GET(req);

    const fetchCall = mockFetch.mock.calls[0][0] as string;
    expect(fetchCall).not.toContain('category=all');
  });

  it('returns gateway error status on non-ok response', async () => {
    mockFailFetch({ error: 'Service down' }, 503);

    const req = makeReq('http://localhost/api/bff/products');
    const res = await GET(req);

    expect(res.status).toBe(503);
  });

  it('returns 500 on unexpected exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const req = makeReq('http://localhost/api/bff/products');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to fetch products');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BFF Products [id] Route
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/bff/products/[id]', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeAll(async () => {
    ({ GET } = await import('@/app/api/bff/products/[id]/route'));
  });

  it('returns product on success', async () => {
    const product = { id: 'p1', title: 'Product 1', price: 10 };
    mockOkFetch(product);

    const req = makeReqWithCookies('http://localhost/api/bff/products/p1', { tec_access_token: 'tok' });
    const params = Promise.resolve({ id: 'p1' });
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe('p1');
  });

  it('returns gateway error on non-ok response', async () => {
    mockFailFetch({ error: 'Not found' }, 404);

    const req = makeReq('http://localhost/api/bff/products/bad-id');
    const params = Promise.resolve({ id: 'bad-id' });
    const res = await GET(req, { params });

    expect(res.status).toBe(404);
  });

  it('returns 500 on exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Fail'));

    const req = makeReq('http://localhost/api/bff/products/p99');
    const params = Promise.resolve({ id: 'p99' });
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to fetch product');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BFF Store [id] Route
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/bff/store/[id]', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeAll(async () => {
    ({ GET } = await import('@/app/api/bff/store/[id]/route'));
  });

  it('returns merchant and products on success', async () => {
    const merchant = { id: 'm1', name: 'Test Merchant' };
    const products = { data: { products: [{ id: 'p1', title: 'P1', price: 5 }] } };
    mockOkFetch({ merchant });  // merchant fetch
    mockOkFetch(products);      // products fetch

    const req = makeReqWithCookies('http://localhost/api/bff/store/m1', { tec_access_token: 'tok' });
    const params = Promise.resolve({ id: 'm1' });
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.products).toHaveLength(1);
  });

  it('returns null merchant when merchant fetch fails', async () => {
    mockFailFetch({ error: 'Not found' }, 404);  // merchant 404
    mockOkFetch({ products: [] });                 // products empty

    const req = makeReq('http://localhost/api/bff/store/bad-m');
    const params = Promise.resolve({ id: 'bad-m' });
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.merchant).toBeNull();
  });

  it('returns empty products when products fetch fails', async () => {
    mockOkFetch({ merchant: { id: 'm1' } });  // merchant ok
    mockFailFetch({ error: 'Fail' }, 500);     // products fail

    const req = makeReq('http://localhost/api/bff/store/m1');
    const params = Promise.resolve({ id: 'm1' });
    const res = await GET(req, { params });
    const data = await res.json();

    expect(data.products).toEqual([]);
  });

  it('handles root-level products array', async () => {
    mockOkFetch({ merchant: { id: 'm1' } });
    mockOkFetch({ products: [{ id: 'p1' }] });

    const req = makeReq('http://localhost/api/bff/store/m1');
    const params = Promise.resolve({ id: 'm1' });
    const res = await GET(req, { params });
    const data = await res.json();

    expect(data.products).toHaveLength(1);
  });

  it('returns 500 on exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const req = makeReq('http://localhost/api/bff/store/m1');
    const params = Promise.resolve({ id: 'm1' });
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to fetch store');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BFF Merchant Products Route
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/bff/merchant/products', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ GET } = await import('@/app/api/bff/merchant/products/route'));
  });

  it('returns 401 when no tec_user cookie', async () => {
    const req = makeReqWithCookies('http://localhost/api/bff/merchant/products', {
      tec_access_token: 'tok',
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 401 when tec_user is malformed JSON', async () => {
    const req = makeReqWithCookies('http://localhost/api/bff/merchant/products', {
      tec_access_token: 'tok',
      tec_user: 'not-json',
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 401 when tec_user has no id', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ piUsername: 'user1' }));
    const req = makeReqWithCookies('http://localhost/api/bff/merchant/products', {
      tec_access_token: 'tok',
      tec_user: userJson,
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns normalized merchant products on success', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'seller-123' }));
    const rawProducts = [
      { id: 'p1', title: 'P1', price: 10, metadata: { images: ['img.jpg'], rating: 4, reviewCount: 5 } },
    ];
    mockOkFetch({ data: { products: rawProducts } });

    const req = makeReqWithCookies('http://localhost/api/bff/merchant/products', {
      tec_access_token: 'tok',
      tec_user: userJson,
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.products[0].images).toEqual(['img.jpg']);
    expect(data.data.products[0].rating).toBe(4);
  });

  it('passes seller_id to gateway', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ sub: 'sub-id-456' }));
    mockOkFetch({ products: [] });

    const req = makeReqWithCookies('http://localhost/api/bff/merchant/products', {
      tec_access_token: 'tok',
      tec_user: userJson,
    });
    await GET(req);

    const fetchCall = mockFetch.mock.calls[0][0] as string;
    expect(fetchCall).toContain('seller_id=sub-id-456');
  });

  it('returns gateway error status on non-ok response', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'seller-x' }));
    mockFailFetch({ error: 'Forbidden' }, 403);

    const req = makeReqWithCookies('http://localhost/api/bff/merchant/products', {
      tec_access_token: 'tok',
      tec_user: userJson,
    });
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it('returns 500 on exception', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'seller-x' }));
    mockFetch.mockRejectedValueOnce(new Error('Net error'));

    const req = makeReqWithCookies('http://localhost/api/bff/merchant/products', {
      tec_access_token: 'tok',
      tec_user: userJson,
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to fetch merchant products');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BFF Orders GET
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/bff/orders', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ GET } = await import('@/app/api/bff/orders/route'));
  });

  it('returns 401 when no tec_user cookie', async () => {
    const req = makeReqWithCookies('http://localhost/api/bff/orders', { tec_access_token: 'tok' });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns orders on success', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'user-1' }));
    const orders = [{ id: 'o1', status: 'pending' }];
    mockOkFetch({ orders });

    const req = makeReqWithCookies('http://localhost/api/bff/orders', {
      tec_access_token: 'tok',
      tec_user: userJson,
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.orders).toHaveLength(1);
  });

  it('passes user id as header and query param', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'user-abc' }));
    mockOkFetch({ orders: [] });

    const req = makeReqWithCookies('http://localhost/api/bff/orders', {
      tec_access_token: 'tok',
      tec_user: userJson,
    });
    await GET(req);

    const fetchCall = mockFetch.mock.calls[0][0] as string;
    const fetchOpts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(fetchCall).toContain('userId=user-abc');
    expect((fetchOpts.headers as Record<string, string>)['x-user-id']).toBe('user-abc');
  });

  it('returns gateway error on non-ok', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'user-1' }));
    mockFailFetch({ error: 'Forbidden' }, 403);

    const req = makeReqWithCookies('http://localhost/api/bff/orders', {
      tec_access_token: 'tok',
      tec_user: userJson,
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 500 on exception', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ uid: 'user-uid' }));
    mockFetch.mockRejectedValueOnce(new Error('fail'));

    const req = makeReqWithCookies('http://localhost/api/bff/orders', {
      tec_access_token: 'tok',
      tec_user: userJson,
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BFF Orders POST
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/bff/orders', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ POST } = await import('@/app/api/bff/orders/route'));
  });

  it('returns 401 when no tec_user cookie', async () => {
    const req = makeReqWithCookies(
      'http://localhost/api/bff/orders',
      { tec_access_token: 'tok' },
      { method: 'POST', body: JSON.stringify({ product_id: 'p1', payment_id: 'pay1' }) },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when payment_id missing', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'user-1' }));
    const req = makeReqWithCookies(
      'http://localhost/api/bff/orders',
      { tec_access_token: 'tok', tec_user: userJson },
      { method: 'POST', body: JSON.stringify({ product_id: 'p1' }) },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('payment_id');
  });

  it('returns 400 when both product_id and items are missing', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'user-1' }));
    const req = makeReqWithCookies(
      'http://localhost/api/bff/orders',
      { tec_access_token: 'tok', tec_user: userJson },
      { method: 'POST', body: JSON.stringify({ payment_id: 'pay1' }) },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates order with single product_id', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'user-1' }));
    const order = { id: 'o1', status: 'pending' };
    mockOkFetch({ order });

    const req = makeReqWithCookies(
      'http://localhost/api/bff/orders',
      { tec_access_token: 'tok', tec_user: userJson },
      { method: 'POST', body: JSON.stringify({ product_id: 'p1', payment_id: 'pay1' }) },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.order).toBeDefined();
  });

  it('creates order with items array', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'user-1' }));
    const order = { id: 'o1' };
    mockOkFetch({ order });

    const items = [{ productId: 'p1', qty: 2 }, { productId: 'p2', qty: 1 }];
    const req = makeReqWithCookies(
      'http://localhost/api/bff/orders',
      { tec_access_token: 'tok', tec_user: userJson },
      { method: 'POST', body: JSON.stringify({ items, payment_id: 'pay1' }) },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(fetchBody.items).toHaveLength(2);
    expect(fetchBody.items[0].productId).toBe('p1');
    expect(fetchBody.items[0].qty).toBe(2);
  });

  it('returns gateway error on non-ok response', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'user-1' }));
    mockFailFetch({ error: 'Conflict' }, 409);

    const req = makeReqWithCookies(
      'http://localhost/api/bff/orders',
      { tec_access_token: 'tok', tec_user: userJson },
      { method: 'POST', body: JSON.stringify({ product_id: 'p1', payment_id: 'pay1' }) },
    );
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it('returns 500 on exception', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ userId: 'user-1' }));
    mockFetch.mockRejectedValueOnce(new Error('fail'));

    const req = makeReqWithCookies(
      'http://localhost/api/bff/orders',
      { tec_access_token: 'tok', tec_user: userJson },
      { method: 'POST', body: JSON.stringify({ product_id: 'p1', payment_id: 'pay1' }) },
    );
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BFF Payment Create Route
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/bff/payment/create', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ POST } = await import('@/app/api/bff/payment/create/route'));
  });

  it('returns 401 when no tec_access_token cookie', async () => {
    const req = makeReq('http://localhost/api/bff/payment/create', {
      method: 'POST',
      body: JSON.stringify({ amount: 10 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when tec_user has no userId', async () => {
    const req = makeReqWithCookies(
      'http://localhost/api/bff/payment/create',
      { tec_access_token: 'tok', tec_user: encodeURIComponent(JSON.stringify({ piUsername: 'user' })) },
      { method: 'POST', body: JSON.stringify({ amount: 10 }) },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('creates payment successfully', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'user-1' }));
    const payData = { id: 'pay-123', status: 'pending' };
    mockOkFetch({ data: payData });

    const req = makeReqWithCookies(
      'http://localhost/api/bff/payment/create',
      { tec_access_token: 'tok', tec_user: userJson },
      { method: 'POST', body: JSON.stringify({ amount: 10, currency: 'PI', metadata: { product_id: 'p1' } }) },
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it('injects source=ecommerce in metadata', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'user-1' }));
    mockOkFetch({ data: { id: 'pay-1' } });

    const req = makeReqWithCookies(
      'http://localhost/api/bff/payment/create',
      { tec_access_token: 'tok', tec_user: userJson },
      { method: 'POST', body: JSON.stringify({ amount: 5, metadata: { product_id: 'p1' } }) },
    );
    await POST(req);

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(fetchBody.metadata.source).toBe('ecommerce');
    expect(fetchBody.userId).toBe('user-1');
  });

  it('uses piId when id is absent', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ piId: 'pi-id-1' }));
    mockOkFetch({ data: { id: 'pay-1' } });

    const req = makeReqWithCookies(
      'http://localhost/api/bff/payment/create',
      { tec_access_token: 'tok', tec_user: userJson },
      { method: 'POST', body: JSON.stringify({ amount: 5 }) },
    );
    await POST(req);

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(fetchBody.userId).toBe('pi-id-1');
  });

  it('returns gateway error on non-ok response', async () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 'user-1' }));
    mockFailFetch({ error: 'Bad request' }, 422);

    const req = makeReqWithCookies(
      'http://localhost/api/bff/payment/create',
      { tec_access_token: 'tok', tec_user: userJson },
      { method: 'POST', body: JSON.stringify({ amount: 5 }) },
    );
    const res = await POST(req);
    expect(res.status).toBe(422);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BFF Payment Resolve-Incomplete Route
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/bff/payment/resolve-incomplete', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ POST } = await import('@/app/api/bff/payment/resolve-incomplete/route'));
  });

  it('returns 401 when no token', async () => {
    const req = makeReq('http://localhost/api/bff/payment/resolve-incomplete', {
      method: 'POST',
      body: JSON.stringify({ pi_payment_id: 'pp1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when pi_payment_id missing', async () => {
    const req = makeReqWithCookies(
      'http://localhost/api/bff/payment/resolve-incomplete',
      { tec_access_token: 'tok' },
      { method: 'POST', body: JSON.stringify({}) },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('resolves payment successfully', async () => {
    mockOkFetch({ success: true, action: 'completed' });

    const req = makeReqWithCookies(
      'http://localhost/api/bff/payment/resolve-incomplete',
      { tec_access_token: 'tok' },
      { method: 'POST', body: JSON.stringify({ pi_payment_id: 'pp-123' }) },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('refreshes token on 401 response', async () => {
    // First resolve attempt returns 401
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    // Token refresh returns new token
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { token: 'new-tok' } }) });
    // Retry resolve succeeds
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });

    const req = makeReqWithCookies(
      'http://localhost/api/bff/payment/resolve-incomplete',
      { tec_access_token: 'tok', tec_refresh_token: 'ref-tok' },
      { method: 'POST', body: JSON.stringify({ pi_payment_id: 'pp-123' }) },
    );
    const res = await POST(req);

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(res.status).toBe(200);
  });

  it('sets new cookie when token refreshed', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { token: 'brand-new-tok' } }) });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });

    const req = makeReqWithCookies(
      'http://localhost/api/bff/payment/resolve-incomplete',
      { tec_access_token: 'old-tok', tec_refresh_token: 'ref-tok' },
      { method: 'POST', body: JSON.stringify({ pi_payment_id: 'pp-456' }) },
    );
    const res = await POST(req);
    const setCookieHeader = res.headers.get('set-cookie');

    expect(setCookieHeader).toContain('tec_access_token=brand-new-tok');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Auth Pi-Login Route
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/pi-login', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ POST } = await import('@/app/api/auth/pi-login/route'));
  });

  it('returns 200 and sets cookies on success', async () => {
    const user = { id: 'u1', piUsername: 'user1' };
    mockOkFetch({ user, tokens: { accessToken: 'tok-123', refreshToken: 'ref-456' }, success: true });

    const req = makeReq('http://localhost/api/auth/pi-login', {
      method: 'POST',
      body: JSON.stringify({ accessToken: 'pi-token' }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('tec_access_token=tok-123');
    expect(setCookie).toContain('tec_user=');
  });

  it('returns gateway error on non-ok', async () => {
    mockFailFetch({ error: 'Unauthorized' }, 401);

    const req = makeReq('http://localhost/api/auth/pi-login', {
      method: 'POST',
      body: JSON.stringify({ accessToken: 'bad-token' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns data without setting cookies when no token in response', async () => {
    const user = { id: 'u1' };
    mockOkFetch({ user, success: true });  // no token

    const req = makeReq('http://localhost/api/auth/pi-login', {
      method: 'POST',
      body: JSON.stringify({ accessToken: 'pi-tok' }),
    });
    const res = await POST(req);

    // should return data but not crash
    expect(res.status).toBe(200);
  });

  it('returns 500 on exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network'));

    const req = makeReq('http://localhost/api/auth/pi-login', {
      method: 'POST',
      body: JSON.stringify({ accessToken: 'tok' }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Auth failed');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Auth Refresh Route
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/refresh', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ POST } = await import('@/app/api/auth/refresh/route'));
  });

  it('returns 200 and sets new token cookie on success', async () => {
    mockOkFetch({ token: 'new-access-tok', data: {} });

    const req = makeReqWithCookies(
      'http://localhost/api/auth/refresh',
      { tec_access_token: 'old-tok', tec_refresh_token: 'ref-tok' },
      { method: 'POST' },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('tec_access_token=new-access-tok');
  });

  it('returns gateway error on non-ok', async () => {
    mockFailFetch({ error: 'Token expired' }, 401);

    const req = makeReqWithCookies(
      'http://localhost/api/auth/refresh',
      { tec_refresh_token: 'bad-ref' },
      { method: 'POST' },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 without setting cookie when no new token in response', async () => {
    mockOkFetch({ message: 'no token here' });

    const req = makeReqWithCookies(
      'http://localhost/api/auth/refresh',
      { tec_access_token: 'tok' },
      { method: 'POST' },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 500 on exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Net fail'));

    const req = makeReq('http://localhost/api/auth/refresh', { method: 'POST' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Refresh failed');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Auth SSO Callback Route
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/auth/sso-callback', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ GET } = await import('@/app/api/auth/sso-callback/route'));
  });

  it('redirects to / when no token param', async () => {
    const req = makeReq('http://localhost/api/auth/sso-callback');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/');
  });

  it('redirects to / when SSO_SECRET not configured', async () => {
    const savedSecret = process.env.SSO_SECRET;
    delete process.env.SSO_SECRET;

    const req = makeReq('http://localhost/api/auth/sso-callback?token=some-token');
    const res = await GET(req);

    expect(res.status).toBe(307);

    process.env.SSO_SECRET = savedSecret;
  });

  it('redirects to / when jwtVerify fails', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('Invalid token'));

    const req = makeReq('http://localhost/api/auth/sso-callback?token=bad-token');
    const res = await GET(req);

    expect(res.status).toBe(307);
  });

  it('sets cookies and redirects to /shop when token valid', async () => {
    const user = { id: 'u1', piUsername: 'user1' };
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        accessToken: 'access-tok-123',
        user,
      },
    });

    const req = makeReq('http://localhost/api/auth/sso-callback?token=valid-jwt');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/shop');
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('tec_access_token=access-tok-123');
  });

  it('redirects to custom redirect param', async () => {
    const user = { id: 'u1' };
    mockJwtVerify.mockResolvedValueOnce({
      payload: { accessToken: 'tok', user },
    });

    const req = makeReq('http://localhost/api/auth/sso-callback?token=jwt&redirect=/orders');
    const res = await GET(req);

    expect(res.headers.get('location')).toContain('/orders');
  });

  it('redirects to / when payload missing accessToken', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { user: { id: 'u1' } },
    });

    const req = makeReq('http://localhost/api/auth/sso-callback?token=jwt');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/');
  });

  it('uses /shop for unsafe redirect values', async () => {
    const user = { id: 'u1' };
    mockJwtVerify.mockResolvedValueOnce({
      payload: { accessToken: 'tok', user },
    });

    const req = makeReq('http://localhost/api/auth/sso-callback?token=jwt&redirect=https://evil.com');
    const res = await GET(req);

    expect(res.headers.get('location')).toContain('/shop');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Payment Force-Cancel Route
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/payment/force-cancel', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ POST } = await import('@/app/api/payment/force-cancel/route'));
  });

  it('returns 401 when no token', async () => {
    const req = makeReq('http://localhost/api/payment/force-cancel', {
      method: 'POST',
      body: JSON.stringify({ pi_payment_id: 'pp1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when pi_payment_id missing', async () => {
    const req = makeReqWithCookies(
      'http://localhost/api/payment/force-cancel',
      { tec_access_token: 'tok' },
      { method: 'POST', body: JSON.stringify({}) },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('attempts cancel and complete', async () => {
    mockOkFetch({ success: true });   // cancel
    mockOkFetch({ success: false });  // complete

    const req = makeReqWithCookies(
      'http://localhost/api/payment/force-cancel',
      { tec_access_token: 'tok' },
      { method: 'POST', body: JSON.stringify({ pi_payment_id: 'pp-123' }) },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results.cancel).toBeDefined();
    expect(data.results.complete).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('handles cancel fetch failure gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('cancel failed'));
    mockOkFetch({ success: true });

    const req = makeReqWithCookies(
      'http://localhost/api/payment/force-cancel',
      { tec_access_token: 'tok' },
      { method: 'POST', body: JSON.stringify({ pi_payment_id: 'pp-err' }) },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results.cancel).toHaveProperty('error');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Payment Resolve-Incomplete Route (non-BFF)
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/payment/resolve-incomplete', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    ({ POST } = await import('@/app/api/payment/resolve-incomplete/route'));
  });

  it('returns 401 when no token', async () => {
    const req = makeReq('http://localhost/api/payment/resolve-incomplete', {
      method: 'POST',
      body: JSON.stringify({ pi_payment_id: 'pp1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when pi_payment_id missing', async () => {
    const req = makeReqWithCookies(
      'http://localhost/api/payment/resolve-incomplete',
      { tec_access_token: 'tok' },
      { method: 'POST', body: JSON.stringify({}) },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('reads pi_payment_id from query string', async () => {
    mockOkFetch({ success: true });

    const req = makeReqWithCookies(
      'http://localhost/api/payment/resolve-incomplete?pi_payment_id=pp-from-query',
      { tec_access_token: 'tok' },
      { method: 'POST' },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('resolves payment on success', async () => {
    mockOkFetch({ success: true, action: 'completed' });

    const req = makeReqWithCookies(
      'http://localhost/api/payment/resolve-incomplete',
      { tec_access_token: 'tok' },
      { method: 'POST', body: JSON.stringify({ pi_payment_id: 'pp-789' }) },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns 500 on exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('net fail'));

    const req = makeReqWithCookies(
      'http://localhost/api/payment/resolve-incomplete',
      { tec_access_token: 'tok' },
      { method: 'POST', body: JSON.stringify({ pi_payment_id: 'pp-err' }) },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Resolve failed');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BFF createHandler
// ══════════════════════════════════════════════════════════════════════════════
describe('createHandler', () => {
  let createHandler: typeof import('@/lib/bff/createHandler').createHandler;
  let AppError: typeof import('@/lib/bff/createHandler').AppError;
  let UnauthorizedError: typeof import('@/lib/bff/createHandler').UnauthorizedError;
  let ForbiddenError: typeof import('@/lib/bff/createHandler').ForbiddenError;
  let NotFoundError: typeof import('@/lib/bff/createHandler').NotFoundError;

  beforeAll(async () => {
    ({ createHandler, AppError, UnauthorizedError, ForbiddenError, NotFoundError } = await import('@/lib/bff/createHandler'));
  });

  it('calls handler with anonymous ctx when requireAuth=false', async () => {
    const handler = createHandler({
      requireAuth: false,
      handler: async ({ ctx }) => ({ userId: ctx.userId }),
    });

    const req = makeReq('http://localhost/test');
    const res = await handler(req);
    const data = await res.json();

    expect(data.userId).toBe('anonymous');
  });

  it('returns 401 when token missing and requireAuth=true (default)', async () => {
    process.env.JWT_SECRET = 'test-secret';

    const handler = createHandler({
      handler: async ({ ctx }) => ({ ok: true }),
    });

    const req = makeReq('http://localhost/test');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('returns 500 when JWT_SECRET not configured', async () => {
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    const handler = createHandler({
      handler: async ({ ctx }) => ({ ok: true }),
    });

    const req = makeReqWithCookies('http://localhost/test', { tec_access_token: 'tok' });
    const res = await handler(req);

    expect(res.status).toBe(500);  // JWT_SECRET not configured = internal error

    process.env.JWT_SECRET = saved;
  });

  it('returns 401 when jwtVerify fails', async () => {
    process.env.JWT_SECRET = 'test-secret';
    mockJwtVerify.mockRejectedValueOnce(new Error('invalid signature'));

    const handler = createHandler({
      handler: async ({ ctx }) => ({ ok: true }),
    });

    const req = makeReqWithCookies('http://localhost/test', { tec_access_token: 'bad-tok' });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 on Zod validation error', async () => {
    const { z } = await import('zod');
    const schema = z.object({ name: z.string() });

    const handler = createHandler({
      requireAuth: false,
      schema,
      handler: async ({ input }) => ({ name: (input as { name: string }).name }),
    });

    const req = makeReq('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ name: 123 }),
    });
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('returns 403 on ForbiddenError from handler', async () => {
    const handler = createHandler({
      requireAuth: false,
      handler: async () => { throw new ForbiddenError('KYC_REQUIRED'); },
    });

    const req = makeReq('http://localhost/test');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('FORBIDDEN');
  });

  it('returns 500 on unexpected error from handler', async () => {
    const handler = createHandler({
      requireAuth: false,
      handler: async () => { throw new Error('Unexpected'); },
    });

    const req = makeReq('http://localhost/test');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('INTERNAL_ERROR');
  });

  it('throws ForbiddenError when KYC required but not verified', async () => {
    process.env.JWT_SECRET = 'test-secret';
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-1', kycVerified: false },
    });

    const handler = createHandler({
      requireKYC: true,
      handler: async ({ ctx }) => ({ ok: true }),
    });

    const req = makeReqWithCookies('http://localhost/test', { tec_access_token: 'tok' });
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.message).toBe('KYC_REQUIRED');
  });

  it('executes handler when JWT valid', async () => {
    process.env.JWT_SECRET = 'test-secret';
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-auth-1', kycVerified: true },
    });

    const handler = createHandler({
      handler: async ({ ctx }) => ({ userId: ctx.userId }),
    });

    const req = makeReqWithCookies('http://localhost/test', { tec_access_token: 'good-tok' });
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.userId).toBe('user-auth-1');
  });

  it('AppError constructs with defaults', () => {
    const err = new AppError('test error');
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('test error');
    expect(err.name).toBe('AppError');
  });

  it('NotFoundError returns 404', () => {
    const err = new NotFoundError('Product');
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('Product');
  });

  it('UnauthorizedError returns 401', () => {
    const err = new UnauthorizedError();
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Server utilities
// ══════════════════════════════════════════════════════════════════════════════
describe('e2e-mode helpers', () => {
  let isE2eMode: () => boolean;
  let e2eStub: (status: number, extra?: Record<string, unknown>) => Response;

  beforeAll(async () => {
    ({ isE2eMode, e2eStub } = await import('@/lib/server/e2e-mode'));
  });

  it('isE2eMode returns false by default', () => {
    delete process.env.E2E_MODE;
    delete process.env.NEXT_PUBLIC_E2E_MODE;
    delete process.env.CI;
    expect(isE2eMode()).toBe(false);
  });

  it('isE2eMode returns true when E2E_MODE=true', () => {
    process.env.E2E_MODE = 'true';
    expect(isE2eMode()).toBe(true);
    delete process.env.E2E_MODE;
  });

  it('isE2eMode returns true when CI=true and E2E_ALLOW_NETWORK not true', () => {
    process.env.CI = 'true';
    expect(isE2eMode()).toBe(true);
    delete process.env.CI;
  });

  it('isE2eMode returns false when CI=true and E2E_ALLOW_NETWORK=true', () => {
    process.env.CI = 'true';
    process.env.E2E_ALLOW_NETWORK = 'true';
    expect(isE2eMode()).toBe(false);
    delete process.env.CI;
    delete process.env.E2E_ALLOW_NETWORK;
  });

  it('e2eStub returns 200 with success=true', async () => {
    const res = e2eStub(200, { data: 'test' });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBe('test');
  });

  it('e2eStub returns 400 with success=false', async () => {
    const res = e2eStub(400);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('e2e-stub');
  });
});

describe('fetchWithTimeout', () => {
  let fetchWithTimeout: typeof import('@/lib/server/fetch-with-timeout').fetchWithTimeout;

  beforeAll(async () => {
    ({ fetchWithTimeout } = await import('@/lib/server/fetch-with-timeout'));
  });

  it('calls fetch with the provided url and init', async () => {
    mockOkFetch({ ok: true });
    const res = await fetchWithTimeout('http://test.example.com/api', { method: 'GET' });
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://test.example.com/api',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
