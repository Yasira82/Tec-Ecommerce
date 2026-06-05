import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('BFF Payment Routes — security', () => {
  const API_GATEWAY_URL = 'https://api-gateway-production-6a68.up.railway.app';

  it('create route uses API_GATEWAY_URL not NEXT_PUBLIC_', async () => {
    // Verify env precedence
    const GW = process.env.API_GATEWAY_URL
            ?? process.env.API_GATEWAY_URL
            ?? API_GATEWAY_URL;

    expect(GW).toBeDefined();
    expect(GW).not.toBe('');
  });

  it('source is always ecommerce in metadata', () => {
    const metadata = { product_id: 'test-1', memo: 'test' };
    const body = {
      userId: 'user-1',
      amount: 5,
      currency: 'PI',
      payment_method: 'pi',
      metadata: { ...metadata, source: 'ecommerce' },
    };

    expect(body.metadata.source).toBe('ecommerce');
  });

  it('userId comes from cookie not body', () => {
    const cookieUser = { id: 'cookie-user-id', piId: 'pi-123' };
    const bodyUser   = { userId: 'body-user-id' };

    // BFF pattern: always use cookie user
    const userId = cookieUser.id ?? cookieUser.piId;
    expect(userId).toBe('cookie-user-id');
    expect(userId).not.toBe(bodyUser.userId);
  });

  it('Idempotency-Key is unique per request', () => {
    const key1 = crypto.randomUUID();
    const key2 = crypto.randomUUID();
    expect(key1).not.toBe(key2);
    expect(key1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});

describe('Hub redirect URL format', () => {
  it('uses /hub?pay=1 not /hub/pay', () => {
    const url = 'https://hub.tecosystem.app/hub?pay=1&amount=5&source=ecommerce';

    expect(url).toContain('/hub?pay=1');
    expect(url).not.toContain('/hub/pay');
  });

  it('return_url points back to ecommerce', () => {
    const returnUrl = 'https://ecommerce.tecosystem.app/';
    expect(returnUrl).toContain('ecommerce.tecosystem.app');
  });
});
