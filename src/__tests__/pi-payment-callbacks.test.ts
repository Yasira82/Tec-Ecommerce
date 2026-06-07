import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const INTERNAL_ID = 'internal-pay-id';

const setupPiWindow = (mockCreatePayment = vi.fn()) => {
  (window as any).__TEC_PI_READY = true;
  (window as any).Pi = {
    authenticate:  vi.fn().mockResolvedValue({}),
    createPayment: mockCreatePayment,
  };
  return mockCreatePayment;
};

const mockGatewayOk = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes('payment/create'))
      return { ok: true, status: 200, json: async () => ({ data: { id: INTERNAL_ID } }) } as Response;
    if (u.includes('payment/approve'))
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    if (u.includes('payment/complete'))
      return { ok: true, status: 200, json: async () => ({ success: true, status: 'completed', txid: 'tx-1' }) } as Response;
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_GATEWAY_URL = 'https://api.example.com';
  Object.defineProperty(document, 'cookie', {
    value:        'tec_access_token=tok-123; tec_csrf=csrf-123',
    configurable: true,
    writable:     true,
  });
});

afterEach(() => {
  delete (window as any).__TEC_PI_READY;
  delete (window as any).Pi;
});

describe('createU2APayment — Pi callbacks', () => {
  it('onCancel → resolves with status=cancelled', async () => {
    vi.resetModules();
    mockGatewayOk();
    const mockCreate = setupPiWindow();

    const { createU2APayment } = await import('@/lib/pi-payment');
    const p = createU2APayment(1, 'test', {}, INTERNAL_ID);
    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const cb = mockCreate.mock.calls[0][1];
    cb.onCancel();
    const result = await p;
    expect(result.success).toBe(false);
    expect(result.status).toBe('cancelled');
  });

  it('onError → rejects with Pi SDK error message', async () => {
    vi.resetModules();
    mockGatewayOk();
    const mockCreate = setupPiWindow();

    const { createU2APayment } = await import('@/lib/pi-payment');
    const p = createU2APayment(1, 'test', {}, INTERNAL_ID);
    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const cb = mockCreate.mock.calls[0][1];
    cb.onError(new Error('insufficient funds'));
    await expect(p).rejects.toThrow('Pi SDK error: insufficient funds');
  });

  it('onReadyForServerApproval → calls /api/bff/payment/approve', async () => {
    vi.resetModules();
    const fetchSpy = mockGatewayOk();
    const mockCreate = setupPiWindow();

    const { createU2APayment } = await import('@/lib/pi-payment');
    const p = createU2APayment(1, 'test', {}, INTERNAL_ID);
    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const cb = mockCreate.mock.calls[0][1];
    await cb.onReadyForServerApproval('pi-pay-abc123');
    cb.onCancel();
    await p;

    const approveCall = fetchSpy.mock.calls.find(([url]) => String(url).includes('payment/approve'));
    expect(approveCall).toBeDefined();
    const body = JSON.parse((approveCall![1] as RequestInit).body as string);
    expect(body.pi_payment_id).toBe('pi-pay-abc123');
    expect(body.payment_id).toBe(INTERNAL_ID);
  });

  it('onReadyForServerApproval with invalid ID → rejects', async () => {
    vi.resetModules();
    mockGatewayOk();
    const mockCreate = setupPiWindow();

    const { createU2APayment } = await import('@/lib/pi-payment');
    const p = createU2APayment(1, 'test', {}, INTERNAL_ID);
    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const cb = mockCreate.mock.calls[0][1];
    cb.onReadyForServerApproval('invalid id!!!');
    await expect(p).rejects.toThrow('Invalid payment ID');
  });

  it('onReadyForServerApproval gateway failure → rejects', async () => {
    vi.resetModules();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('payment/create'))
        return { ok: true, status: 200, json: async () => ({ data: { id: INTERNAL_ID } }) } as Response;
      if (u.includes('payment/approve'))
        return { ok: false, status: 422, json: async () => ({ message: 'Invalid payment' }) } as Response;
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    const mockCreate = setupPiWindow();

    const { createU2APayment } = await import('@/lib/pi-payment');
    const p = createU2APayment(1, 'test', {}, INTERNAL_ID);
    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const cb = mockCreate.mock.calls[0][1];
    await cb.onReadyForServerApproval('pi-pay-abc123');
    await expect(p).rejects.toThrow('Invalid payment');
  });

  it('onReadyForServerCompletion → resolves with success', async () => {
    vi.resetModules();
    mockGatewayOk();
    const mockCreate = setupPiWindow();

    const { createU2APayment } = await import('@/lib/pi-payment');
    const p = createU2APayment(1, 'Test', {}, INTERNAL_ID);
    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const cb = mockCreate.mock.calls[0][1];
    await cb.onReadyForServerApproval('pi-pay-abc123');
    await cb.onReadyForServerCompletion('pi-pay-abc123', 'txid-xyz');
    const result = await p;
    expect(result.success).toBe(true);
    expect(result.status).toBe('completed');
  });

  it('onReadyForServerCompletion with invalid txid → rejects', async () => {
    vi.resetModules();
    mockGatewayOk();
    const mockCreate = setupPiWindow();

    const { createU2APayment } = await import('@/lib/pi-payment');
    const p = createU2APayment(1, 'test', {}, INTERNAL_ID);
    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const cb = mockCreate.mock.calls[0][1];
    await cb.onReadyForServerApproval('pi-pay-abc123');
    cb.onReadyForServerCompletion('pi-pay-abc123', 'bad txid!!!');
    await expect(p).rejects.toThrow('Invalid payment data');
  });

  it('onReadyForServerCompletion passes transaction_id not txid', async () => {
    vi.resetModules();
    const fetchSpy = mockGatewayOk();
    const mockCreate = setupPiWindow();

    const { createU2APayment } = await import('@/lib/pi-payment');
    const p = createU2APayment(1, 'Test', {}, INTERNAL_ID);
    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const cb = mockCreate.mock.calls[0][1];
    await cb.onReadyForServerApproval('pi-pay-abc123');
    await cb.onReadyForServerCompletion('pi-pay-abc123', 'txid-xyz');
    await p;

    const completeCall = fetchSpy.mock.calls.find(([url]) => String(url).includes('payment/complete'));
    expect(completeCall).toBeDefined();
    const body = JSON.parse((completeCall![1] as RequestInit).body as string);
    expect(body).toHaveProperty('transaction_id', 'txid-xyz');
    expect(body).not.toHaveProperty('txid');
  });
});
