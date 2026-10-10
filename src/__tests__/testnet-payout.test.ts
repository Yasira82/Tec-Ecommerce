/**
 * The Testnet payout page (tec-core-backend #410): only on the Testnet host, asks Pi for
 * wallet_address, forwards the session token + the Pi sign-in and names the app.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

const req = (host: string, body: unknown, token: string | null = 'tok') => {
  const r = new NextRequest(`https://${host}/api/bff/testnet-payout`, {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  });
  if (token) r.cookies.set('tec_access_token', token);
  return r;
};

beforeEach(() => { process.env.API_GATEWAY_URL = 'https://gw'; vi.restoreAllMocks(); vi.resetModules(); });

describe('BFF /api/bff/testnet-payout', () => {
  it('does not exist on the Mainnet host', async () => {
    const { POST } = await import('@/app/api/bff/testnet-payout/route');
    expect((await POST(req('ecommerce.tecosystem.app', { pi_access_token: 'p' }))).status).toBe(404);
  });

  it('on the Testnet host: needs a session and a Pi sign-in; forwards both and names ecommerce', async () => {
    const f = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, data: { txid: 't' } }), { status: 200 }));
    const { POST } = await import('@/app/api/bff/testnet-payout/route');
    expect((await POST(req('ecommerce-test.tecosystem.app', { pi_access_token: 'p' }, null))).status).toBe(401);
    expect((await POST(req('ecommerce-test.tecosystem.app', {}))).status).toBe(400);
    expect((await POST(req('ecommerce-test.tecosystem.app', { pi_access_token: 'p' }))).status).toBe(200);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://gw/api/payment/testnet-gate/claim');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(init.body))).toEqual({ source: 'ecommerce', pi_access_token: 'p' });
  });
});

describe('the page', () => {
  it('asks Pi for wallet_address and respects a Hub-owned session (ADR-007)', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/testnet-payout/page.tsx'), 'utf8');
    expect(src).toContain("['username', 'payments', 'wallet_address']");
    expect(src).toContain('__TEC_PI_FOREIGN_SESSION');
  });
});
