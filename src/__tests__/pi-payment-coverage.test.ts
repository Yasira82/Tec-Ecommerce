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
    delete (window as any).__TEC_PI_READY;
    delete (window as any).Pi;
  });

  it('resolves with status=error when window.Pi is not available', async () => {
    vi.resetModules();
    delete (window as any).__TEC_PI_READY;
    delete (window as any).Pi;
    const { createU2APayment } = await import('@/lib/pi-payment');
    const result = await createU2APayment(5, 'test', {}, 'valid-id');
    expect(result.status).toBe('error');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Pi SDK not ready');
  });

  it('resolves with status=error when Pi.authenticate throws', async () => {
    vi.resetModules();
    (window as any).__TEC_PI_READY = true;
    (window as any).Pi = {
      authenticate:  vi.fn().mockRejectedValue(new Error('auth rejected')),
      createPayment: vi.fn(),
    };
    const { createU2APayment } = await import('@/lib/pi-payment');
    const result = await createU2APayment(5, 'test', {}, 'valid-id');
    expect(result.status).toBe('error');
    expect(result.success).toBe(false);
    expect(result.message).toContain('auth rejected');
  });
});
