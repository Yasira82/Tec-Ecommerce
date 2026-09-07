import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isTestnetHost, networkMetadata } from '@/lib/pi-network';

/**
 * Which Pi network a request is on.
 *
 * A `.pi` domain requires a Pi app, and Pi issues every app TWICE — a Mainnet
 * one and a paired Testnet one, both registered against the SAME deployment on
 * different hosts. One build serves both, so `NEXT_PUBLIC_PI_SANDBOX` cannot
 * answer this: it is baked at build time and there is only one build.
 *
 * The consequence of getting it wrong in the permissive direction is a free
 * subscription: a payment made with Test-Pi that a consumer treats as real.
 */

describe('the host decides the network', () => {
  it('reads the paired Testnet app from a vercel.app host', () => {
    for (const h of [
      'tec-app.vercel.app',
      'tec-app-frontend.vercel.app',
      'TEC-APP.VERCEL.APP',
      'tec-app.vercel.app:443',
      ' tec-app.vercel.app ',
    ]) {
      expect(isTestnetHost(h)).toBe(true);
    }
  });

  it('reads a custom domain as Mainnet', () => {
    for (const h of [
      'app.tecosystem.app',
      'hub.tecosystem.app',
      'localhost:3000',
    ]) {
      expect(isTestnetHost(h)).toBe(false);
    }
  });

  it('is not fooled by a host that merely CONTAINS the string', () => {
    // The match is anchored to the end. Without that, anyone who could get a
    // request to this app under a hostname they control could ask for the test
    // network — and the whole point of deciding server-side is that they cannot.
    for (const h of [
      'vercel.app.attacker.com',
      'notvercel.app.example.com',
      'tec-app.vercel.app.evil.com',
    ]) {
      expect(isTestnetHost(h)).toBe(false);
    }
  });

  it('treats a missing host as Mainnet, never as testnet', () => {
    // Fail closed in the direction that costs nothing: an unknown host means a
    // real payment, which at worst fails. The other way round it succeeds with
    // Test-Pi and something real gets granted.
    expect(isTestnetHost(undefined)).toBe(false);
    expect(isTestnetHost(null)).toBe(false);
    expect(isTestnetHost('')).toBe(false);
  });
});

describe('what travels with the payment', () => {
  it('marks a testnet payment, and marks nothing on a real one', () => {
    // Present only when true: a `testnet: false` on every Mainnet payment would
    // put a field about the test network on 100% of real money, and the day it
    // is written wrong is the day it means the opposite of what it says.
    expect(networkMetadata('tec-app.vercel.app')).toEqual({ testnet: true });
    expect(networkMetadata('app.tecosystem.app')).toEqual({});
  });
});

describe('the client and the server read the same fact separately', () => {
  const loader = readFileSync(join(process.cwd(), 'src/components/PiSdkLoader.tsx'), 'utf8');
  const route  = readFileSync(join(process.cwd(), 'src/app/api/bff/payment/create/route.ts'), 'utf8');

  // Ecommerce does NOT carry the template's inline layout script: Pi.init lives
  // in the PiSdkLoader client component, which takes the build flag as a prop.
  // The assertions below pin THAT shape — the behaviour is what matters, and a
  // test written against a file this app does not have proves nothing.

  it('Pi.init picks the network from the browser\u2019s own hostname', () => {
    // Not from a build-time flag alone — one build serves both Pi apps, so
    // NEXT_PUBLIC_PI_SANDBOX is the same string on the Mainnet host and the
    // paired Testnet one by construction.
    expect(loader).toMatch(/\.test\(window\.location\.hostname\)/);
    expect(loader).toContain('vercel');
  });

  it('the BFF derives it from its OWN Host header', () => {
    expect(route).toContain("networkMetadata(req.headers.get('host'))");
  });

  it('the Testnet host gets sandbox=FALSE — sandbox is not testnet', () => {
    // Measured, not assumed. With sandbox:true on `*.vercel.app` the Pi bridge
    // never answered its first message ("Messaging promise with id 1 timed out
    // after 120000ms"). Same host, same build, that flag false: the wallet
    // opened and the payment reached approve.
    //
    // They are different axes. The HOST decides which Pi app the visitor is in
    // (and so which network the server approves against); `sandbox` points the
    // SDK at Pi's Sandbox ENVIRONMENT, a third thing. A paired Testnet app is a
    // normal app on its own domain, not the sandbox.
    expect(loader).toMatch(/get\('pi_sandbox'\) === '1'/);
    // The opposite default must not creep back — an override that is on unless
    // explicitly switched off is the bug, worn as a default.
    expect(loader).not.toMatch(/pi_sandbox'\) !== '0'/);
  });

  it('the sandbox override is confined to the Testnet host', () => {
    // The Mainnet arm returns the build flag, untouched by the URL: on a host
    // that is not `*.vercel.app` the query string is never even read.
    expect(loader).toMatch(/if \(!isTestnetHost\) return configured;/);
    // …and the query is read in exactly one place, so it cannot have grown a
    // second use on the Mainnet side.
    expect(loader.match(/pi_sandbox/g) ?? []).toHaveLength(2); // the doc line + the read
  });

  it('the BFF DROPS whatever the client sent', () => {
    // Removed before the spread, not merely overwritten by it. On the Mainnet
    // host networkMetadata() returns {}, so an overwrite is no overwrite at
    // all — a client that could set this could pay with Test-Pi and have a
    // consumer grant it something real.
    expect(route).toMatch(/const \{ testnet: _clientTestnet, \.\.\.metadata \}/);
  });
});
