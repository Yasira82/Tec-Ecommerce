// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const GW = 'https://api.example.com';

const makeReq = (opts: {
  cookies?: Record<string, string>;
  body?:    unknown;
  url?:     string;
}) => {
  const cookieStr = opts.cookies
    ? Object.entries(opts.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
    : '';
  return new NextRequest(opts.url ?? 'http://localhost/api/bff/payment/approve', {
    method:  'POST',
    headers: cookieStr ? { Cookie: cookieStr } : {},
    body:    opts.body ? JSON.stringify(opts.body) : undefined,
  });
};

const userCookie = JSON.stringify({ id: 'user-123', piId: 'pi-456' });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_GATEWAY_URL = GW;
});

// ── POST /api/bff/payment/approve ───────────────────────────────
describe('POST /api/bff/payment/approve', () => {
  it('returns 401 when token missing', async () => {
    const { POST } = await import('@/app/api/bff/payment/approve/route');
    const res = await POST(makeReq({ body: { payment_id: 'p1', pi_payment_id: 'pi1' } }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 200 and forwards gateway response on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ approved: true }),
    } as Response);

    const { POST } = await import('@/app/api/bff/payment/approve/route');
    const res = await POST(makeReq({
      cookies: { tec_access_token: 'tok-123', tec_user: userCookie },
      body:    { payment_id: 'pay-1', pi_payment_id: 'pi-pay-1' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.approved).toBe(true);
  });

  it('forwards gateway error status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false, status: 409,
      json: async () => ({ error: 'Already approved' }),
    } as Response);

    const { POST } = await import('@/app/api/bff/payment/approve/route');
    const res = await POST(makeReq({
      cookies: { tec_access_token: 'tok-123' },
      body:    { payment_id: 'pay-1', pi_payment_id: 'pi-pay-1' },
    }));
    expect(res.status).toBe(409);
  });

  it('adds Idempotency-Key header to gateway call', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({}),
    } as Response);

    const { POST } = await import('@/app/api/bff/payment/approve/route');
    await POST(makeReq({
      cookies: { tec_access_token: 'tok-123' },
      body:    { payment_id: 'pay-1', pi_payment_id: 'pi-pay-1' },
    }));

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-/
    );
  });

  it('merges userId from cookie into gateway body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({}),
    } as Response);

    const { POST } = await import('@/app/api/bff/payment/approve/route');
    await POST(makeReq({
      cookies: { tec_access_token: 'tok-123', tec_user: userCookie },
      body:    { payment_id: 'pay-1', pi_payment_id: 'pi-pay-1' },
    }));

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sent = JSON.parse(init.body);
    expect(sent.userId).toBe('user-123');
  });
});

// ── POST /api/bff/payment/complete ──────────────────────────────
describe('POST /api/bff/payment/complete', () => {
  it('returns 401 when token missing', async () => {
    const { POST } = await import('@/app/api/bff/payment/complete/route');
    const res = await POST(
      new NextRequest('http://localhost/api/bff/payment/complete', {
        method: 'POST',
        body:   JSON.stringify({ payment_id: 'p1', transaction_id: 'tx1' }),
      })
    );
    expect(res.status).toBe(401);
  });

  it('forwards successful completion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ success: true, status: 'completed' }),
    } as Response);

    const { POST } = await import('@/app/api/bff/payment/complete/route');
    const res = await POST(makeReq({
      url:     'http://localhost/api/bff/payment/complete',
      cookies: { tec_access_token: 'tok-123' },
      body:    { payment_id: 'pay-1', transaction_id: 'txid-abc' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('forwards 409 from gateway (already completed)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false, status: 409,
      json: async () => ({ error: 'Payment already completed' }),
    } as Response);

    const { POST } = await import('@/app/api/bff/payment/complete/route');
    const res = await POST(makeReq({
      url:     'http://localhost/api/bff/payment/complete',
      cookies: { tec_access_token: 'tok-123' },
      body:    { payment_id: 'pay-1', transaction_id: 'txid-abc' },
    }));
    expect(res.status).toBe(409);
  });

  it('passes transaction_id not txid to gateway', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({}),
    } as Response);

    const { POST } = await import('@/app/api/bff/payment/complete/route');
    await POST(makeReq({
      url:     'http://localhost/api/bff/payment/complete',
      cookies: { tec_access_token: 'tok-123' },
      body:    { payment_id: 'pay-1', transaction_id: 'tx-999' },
    }));

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sent = JSON.parse(init.body);
    expect(sent).toHaveProperty('transaction_id', 'tx-999');
    expect(sent).not.toHaveProperty('txid');
  });

  it('adds Idempotency-Key to gateway call', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({}),
    } as Response);

    const { POST } = await import('@/app/api/bff/payment/complete/route');
    await POST(makeReq({
      url:     'http://localhost/api/bff/payment/complete',
      cookies: { tec_access_token: 'tok-123' },
      body:    { payment_id: 'pay-1', transaction_id: 'tx-1' },
    }));

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-/
    );
  });
});
