import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── isHubNavigation ──────────────────────────────────────
describe('isHubNavigation', () => {
  const isHubNavigation = (): boolean => {
    if (typeof document === 'undefined') return false;
    return document.referrer.toLowerCase().includes('hub.tecosystem.app');
  };

  it('returns true when referrer is hub', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://hub.tecosystem.app/dashboard', configurable: true,
    });
    expect(isHubNavigation()).toBe(true);
  });

  it('returns false when referrer is empty', () => {
    Object.defineProperty(document, 'referrer', {
      value: '', configurable: true,
    });
    expect(isHubNavigation()).toBe(false);
  });

  it('returns false when referrer is another domain', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://commerce.tecosystem.app/', configurable: true,
    });
    expect(isHubNavigation()).toBe(false);
  });

  it('returns false for external referrer', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://google.com', configurable: true,
    });
    expect(isHubNavigation()).toBe(false);
  });
});

// ── redirectToHubPayment URL format ─────────────────────
describe('Hub redirect URL', () => {
  it('builds correct Mode 1 URL with pay=1', () => {
    const product = { id: 'prod-1', title: 'Test Product', price: 5 };
    const HUB_URL = 'https://hub.tecosystem.app';
    const APP_URL = 'https://ecommerce.tecosystem.app';

    const params = new URLSearchParams({
      pay:        '1',
      amount:     product.price.toString(),
      memo:       `${product.title} — TEC Ecommerce`,
      product_id: product.id,
      return_url: `${APP_URL}/`,
      source:     'ecommerce',
    });
    const url = `${HUB_URL}/hub?${params.toString()}`;

    expect(url).toContain('/hub?');
    expect(url).toContain('pay=1');
    expect(url).toContain('source=ecommerce');
    expect(url).toContain('amount=5');
    expect(url).not.toContain('/hub/pay');
  });
});

// ── createPaymentRecord ──────────────────────────────────
describe('createPaymentRecord', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, 'cookie', {
      value: 'tec_access_token=test-token; tec_csrf=csrf-123',
      configurable: true, writable: true,
    });
  });

  it('returns payment ID on success', async () => {
    const mockResponse = { data: { payment: { id: 'pay-uuid-123' } } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => mockResponse,
    } as Response);

    const { createPaymentRecord } = await import('@/lib/pi-payment');
    const id = await createPaymentRecord(10, 'product-1', 'Test memo');

    expect(id).toBe('pay-uuid-123');
    expect(fetch).toHaveBeenCalledWith('/api/bff/payment/create', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('returns null on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false, status: 500,
      json: async () => ({ error: 'Server error' }),
    } as Response);

    const { createPaymentRecord } = await import('@/lib/pi-payment');
    const id = await createPaymentRecord(10, 'product-1', 'Test memo');

    expect(id).toBeNull();
  });

  it('sends source:ecommerce in metadata', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ data: { id: 'pay-1' } }),
    } as Response);

    const { createPaymentRecord } = await import('@/lib/pi-payment');
    await createPaymentRecord(5, 'prod-1', 'memo');

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);
    expect(body.metadata.source).toBe('ecommerce');
  });
});

// ── PiSdkLoader FOREIGN_SESSION ─────────────────────────
describe('FOREIGN_SESSION detection', () => {
  it('sets FOREIGN_SESSION when Pi.init throws already initialized', () => {
    (window as any).__TEC_PI_FOREIGN_SESSION = undefined;
    (window as any).__TEC_PI_READY = undefined;

    (window as any).Pi = {
      init: () => { throw new Error('Pi SDK already initialized'); },
    };

    // Simulate PiSdkLoader logic
    try {
      window.Pi.init({ version: '2.0', sandbox: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      if (msg.includes('already') || msg.includes('initialized')) {
        (window as any).__TEC_PI_FOREIGN_SESSION = true;
      }
    }
    (window as any).__TEC_PI_READY = true;

    expect((window as any).__TEC_PI_FOREIGN_SESSION).toBe(true);
    expect((window as any).__TEC_PI_READY).toBe(true);
  });

  it('does NOT set FOREIGN_SESSION on normal init', () => {
    (window as any).__TEC_PI_FOREIGN_SESSION = undefined;
    (window as any).__TEC_PI_READY = undefined;

    (window as any).Pi = {
      init: () => { /* success */ },
    };

    try {
      window.Pi.init({ version: '2.0', sandbox: false });
    } catch { /* */ }
    (window as any).__TEC_PI_READY = true;

    expect((window as any).__TEC_PI_FOREIGN_SESSION).toBeUndefined();
    expect((window as any).__TEC_PI_READY).toBe(true);
  });
});
