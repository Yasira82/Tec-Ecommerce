import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// A visitor is counted once — the handshake that counts them toward the .pi
// domain does not repeat on every visit (owner, 10 Nov 2026).

const authenticate = vi.fn();
const me = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue({ ok: status === 200, status, json: async () => body });

describe('visit sign-in: once per person, not per visit', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    authenticate.mockReset().mockResolvedValue({ accessToken: 't', user: { username: 'Yas55eR82' } });
    (window as unknown as { Pi: unknown }).Pi = { authenticate };
    delete (window as unknown as { __TEC_PI_FOREIGN_SESSION?: boolean }).__TEC_PI_FOREIGN_SESSION;
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('first visit signs in with Pi and remembers the person', async () => {
    vi.stubGlobal('fetch', me({ authenticated: true, user: { username: 'yas55eR82' } }));
    const { visitSignInOnce } = await import('@/components/pi/PiVisitSignIn');
    await expect(visitSignInOnce()).resolves.toBe('signed-in');
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it('a later visit by the same person does NOT sign in again', async () => {
    vi.stubGlobal('fetch', me({ authenticated: true, user: { username: 'yas55eR82' } }));
    await (await import('@/components/pi/PiVisitSignIn')).visitSignInOnce();
    vi.resetModules();                                   // a new page load
    const { visitSignInOnce } = await import('@/components/pi/PiVisitSignIn');
    await expect(visitSignInOnce()).resolves.toBe('counted-before');
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it('a different person on the same device is still counted', async () => {
    vi.stubGlobal('fetch', me({ authenticated: true, user: { username: 'yas55eR82' } }));
    await (await import('@/components/pi/PiVisitSignIn')).visitSignInOnce();
    vi.resetModules();
    vi.stubGlobal('fetch', me({ authenticated: true, user: { username: 'someoneElse' } }));
    authenticate.mockResolvedValue({ accessToken: 't', user: { username: 'someoneElse' } });
    const { visitSignInOnce } = await import('@/components/pi/PiVisitSignIn');
    await expect(visitSignInOnce()).resolves.toBe('signed-in');
    expect(authenticate).toHaveBeenCalledTimes(2);
  });

  it('a visitor with no session still signs in — that is also how they log in', async () => {
    vi.stubGlobal('fetch', me({ authenticated: false, user: null }, 401));
    const { visitSignInOnce } = await import('@/components/pi/PiVisitSignIn');
    await expect(visitSignInOnce()).resolves.toBe('signed-in');
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it('a refused sign-in is not remembered — the next visit tries again', async () => {
    vi.stubGlobal('fetch', me({ authenticated: true, user: { username: 'yas55eR82' } }));
    authenticate.mockRejectedValueOnce(new Error('no'));
    await expect((await import('@/components/pi/PiVisitSignIn')).visitSignInOnce()).resolves.toBe('not-signed-in');
    vi.resetModules();
    await expect((await import('@/components/pi/PiVisitSignIn')).visitSignInOnce()).resolves.toBe('signed-in');
  });

  it('a repeat visit still reports the arrival — the Round 3 mission ticks without a new handshake', async () => {
    vi.stubGlobal('fetch', me({ authenticated: true, user: { username: 'yas55eR82' } }));
    await (await import('@/components/pi/PiVisitSignIn')).visitSignInOnce();
    vi.resetModules();
    const mod = await import('@/lib/pi/visit-sign-in');
    const arrived = vi.fn();
    mod.onPiSignedIn(arrived);
    await expect((await import('@/components/pi/PiVisitSignIn')).visitSignInOnce()).resolves.toBe('counted-before');
    expect(arrived).toHaveBeenCalledTimes(1);
    expect(authenticate).toHaveBeenCalledTimes(1);
  });
});
