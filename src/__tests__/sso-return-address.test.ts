// @vitest-environment node
//
// The return address this app hands the Hub — for a login, and for a Mode-1
// payment — must be read from the LIVE host, and it must be read in ONE place.
//
// This app had `APP_URL` redeclared as a module constant in EIGHT files. A
// build-time constant is the same string on the Mainnet host and on the paired
// Testnet one by construction, so a Testnet visitor was handed to the Hub with
// the Mainnet return address: the Hub signed them in perfectly and returned
// them to the OTHER origin, where the session then lived. The Testnet host
// stayed "Unauthorized" forever with nothing in any log — because nothing
// failed. The same constant is the `return_url` of a Mode-1 payment, so the π
// moved and the buyer landed on the wrong host with no order.
//
// Eight copies is also how two of them drift apart, which is exactly what
// happened in Commerce: `/app` was fixed and the landing page was not.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const sourceFiles = () =>
  walk(SRC).filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__'));

describe('the return address has exactly one definition', () => {
  it('no file redeclares the origin as a module constant', () => {
    const offenders = sourceFiles().filter((f) =>
      /const APP_URL\s*=\s*process\.env\.NEXT_PUBLIC_APP_URL/.test(readFileSync(f, 'utf8')),
    );
    // Named rather than counted: a failure should say which file regrew it.
    expect(offenders.map((f) => f.replace(`${process.cwd()}/`, ''))).toEqual([]);
  });

  it('the helper reads the live origin, and only falls back during SSR', () => {
    const s = readFileSync(join(SRC, 'lib-client/app-origin.ts'), 'utf8');
    expect(s).toMatch(/typeof window === 'undefined'\s*\?\s*CONFIGURED_APP_URL\s*:\s*window\.location\.origin/);
  });

  it('every site that sends the user away uses it', () => {
    // The four Mode-1 payment return_urls, and the three login bounces.
    const sites = [
      'components/shop/CartDrawer.tsx',
      'app/page.tsx',
      'app/shop/page.tsx',
      'app/store/[id]/page.tsx',
      'app/product/[id]/page.tsx',
      'app/orders/page.tsx',
      'app/merchant/page.tsx',
    ];
    for (const rel of sites) {
      const s = readFileSync(join(SRC, rel), 'utf8');
      expect.soft(s, rel).toMatch(/appOrigin\(\)/);
      expect.soft(s, rel).toMatch(/from '@\/lib-client\/app-origin'/);
    }
  });
});

describe('the SSO audiences name real hosts, and only real hosts', () => {
  const route = () => readFileSync(join(SRC, 'app/api/auth/sso-callback/route.ts'), 'utf8');

  it('is never widened to a pattern', () => {
    // The Hub's /api/auth/sso hands the target a signed token carrying the
    // user's access token, and anyone can deploy a `*.vercel.app` host. An
    // allowlist that matches by suffix hands sessions to a stranger.
    const s = route();
    expect(s).not.toMatch(/\*\.vercel\.app/);
    expect(s).not.toMatch(/endsWith\(\s*['"]\.vercel\.app/);
  });
});
