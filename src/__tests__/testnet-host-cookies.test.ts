/**
 * On the Testnet host (`tec-ecommerce.vercel.app`) a cookie with Domain=.tecosystem.app
 * is dropped by the browser, silently. Production, 2026-10-10: Pi sign-in succeeded and
 * the next request still said "Sign in first" for every Pi account but the one already
 * signed in. Every route that SETS or CLEARS session cookies goes through cookieDomainFor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

beforeEach(() => { process.env.API_GATEWAY_URL = 'https://gw'; process.env.COOKIE_DOMAIN = '.tecosystem.app'; vi.restoreAllMocks(); vi.resetModules(); });

const login = (host: string) => new NextRequest(`https://${host}/api/auth/pi-login`, {
  method: 'POST', body: JSON.stringify({ accessToken: 'pi' }), headers: { 'content-type': 'application/json' },
});

describe('pi-login cookies', () => {
  it('Testnet host → host-only cookies (no Domain); Mainnet host → .tecosystem.app', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ user: { id: 'u' }, tokens: { accessToken: 't' } }), { status: 200 }));
    const { POST } = await import('@/app/api/auth/pi-login/route');
    const testnet = (await POST(login('tec-ecommerce.vercel.app'))).headers.getSetCookie().join('\n');
    expect(testnet).toMatch(/tec_access_token=t/);
    expect(testnet).not.toMatch(/Domain=/i);
    const mainnet = (await POST(login('ecommerce.tecosystem.app'))).headers.getSetCookie().join('\n');
    expect(mainnet).toMatch(/Domain=\.?tecosystem\.app/i);
  });
});

describe('every route that sets or clears a session cookie', () => {
  it('uses cookieDomainFor, never the raw COOKIE_DOMAIN', () => {
    for (const f of ['pi-login', 'refresh', 'logout', 'sso-callback']) {
      const src = readFileSync(join(process.cwd(), `src/app/api/auth/${f}/route.ts`), 'utf8');
      expect(src, f).toContain('cookieDomainFor(');
      expect(src, f).not.toMatch(/const cookieDomain\s*=\s*process\.env\.COOKIE_DOMAIN/);
    }
  });
});
