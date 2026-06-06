import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Covers uncovered branches in src/lib/pi-payment.ts

describe('createPaymentRecord — edge cases', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when no access token in cookie', async () => {
    Object.defineProperty(document, 'cookie', {
      value: 'tec_csrf=csrf-123',
      configurable: true, writable: true,
    });
    vi.resetModules();
    const { createPaymentRecord } = await import('@/lib/pi-payment');
    const id = await createPaymentRecord(5, 'prod-1', 'memo');
    expect(id).toBeNull();
  });

  it('returns null when fetch throws a network error', async () => {
    Object.defineProperty(document, 'cookie', {
      value: 'tec_access_token=test-token; tec_csrf=csrf-123',
      configurable: true, writable: true,
    });
    vi.resetModules();
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    const { createPaymentRecord } = await import('@/lib/pi-payment');
    const id = await createPaymentRecord(5, 'prod-1', 'memo');
    expect(id).toBeNull();
  });

  it('returns id from data.data.id fallback', async () => {
    Object.defineProperty(document, 'cookie', {
      value: 'tec_access_token=test-token; tec_csrf=csrf-123',
      configurable: true, writable: true,
    });
    vi.resetModules();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ data: { id: 'pay-fallback-id' } }),
    } as Response);
    const { createPaymentRecord } = await import('@/lib/pi-payment');
    const id = await createPaymentRecord(5, 'prod-1', 'memo');
    expect(id).toBe('pay-fallback-id');
  });

  it('returns id from root data.id fallback', async () => {
    Object.defineProperty(document, 'cookie', {
      value: 'tec_access_token=test-token; tec_csrf=csrf-123',
      configurable: true, writable: true,
    });
    vi.resetModules();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ id: 'pay-root-id' }),
    } as Response);
    const { createPaymentRecord } = await import('@/lib/pi-payment');
    const id = await createPaymentRecord(5, 'prod-1', 'memo');
    expect(id).toBe('pay-root-id');
  });
});

describe('createU2APayment — guard checks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws Missing internalId when internalId is empty string', async () => {
    vi.resetModules();
    (window as any).__TEC_PI_READY = true;
    (window as any).Pi = {
      authenticate: vi.fn().mockResolvedValue({}),
      createPayment: vi.fn(),
    };
    const { createU2APayment } = await import('@/lib/pi-payment');
    await expect(createU2APayment(5, 'test', {}, '')).rejects.toThrow('Missing internalId');
  });

  it('waitForPiSdk slow-path resolves via tec-pi-ready event and throws when Pi unavailable', async () => {
    vi.resetModules();
    delete (window as any).__TEC_PI_READY;
    delete (window as any).Pi;

    // Fire the event after tiny delay to exercise the slow path
    setTimeout(() => {
      window.dispatchEvent(new Event('tec-pi-ready'));
    }, 5);

    const { createU2APayment } = await import('@/lib/pi-payment');

    // After waitForPiSdk resolves, window.Pi is still undefined → throws
    await expect(
      createU2APayment(5, 'test', {}, 'valid-internal-id'),
    ).rejects.toThrow('Pi SDK not available');
  });
});
