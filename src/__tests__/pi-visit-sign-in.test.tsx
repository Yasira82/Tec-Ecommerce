/**
 * The visit sign-in: Pi counts an app's visitor only once Pi.authenticate ran IN
 * the app. The username on screen comes from the Hub's cookie and proves nothing
 * to Pi — which is why this app's `.pi` claim stayed "Requirements Not Met"
 * (2026-09-29). See src/lib/pi/visit-sign-in.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, act } from '@testing-library/react';
import { piVisitSignIn, __resetPiVisitSignIn } from '@/lib/pi/visit-sign-in';
import { PiVisitSignIn } from '@/components/pi/PiVisitSignIn';

type W = { Pi?: unknown; __TEC_PI_READY?: boolean; __TEC_PI_FOREIGN_SESSION?: boolean };
const w = window as unknown as W;

describe('visit sign-in', () => {
  let authenticate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetPiVisitSignIn();
    authenticate = vi.fn().mockResolvedValue({ accessToken: 't', user: { username: 'p' } });
    w.Pi = { authenticate };
  });
  afterEach(() => {
    delete w.Pi;
    delete w.__TEC_PI_READY;
    delete w.__TEC_PI_FOREIGN_SESSION;
  });

  it('asks Pi to sign the visitor in, with the scopes the payment path uses', async () => {
    await expect(piVisitSignIn()).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledWith(['username', 'payments'], expect.any(Function));
  });

  it('never in a Hub-owned session (ADR-007) — Pi.authenticate would never answer there', async () => {
    w.__TEC_PI_FOREIGN_SESSION = true;
    await expect(piVisitSignIn()).resolves.toBe(false);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('one handshake per page load: concurrent callers share it, later callers reuse it', async () => {
    const [a, b] = await Promise.all([piVisitSignIn(), piVisitSignIn()]);
    expect(a && b).toBe(true);
    await piVisitSignIn();
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it('a refusal is silent and can be retried', async () => {
    authenticate.mockRejectedValueOnce(new Error('user closed the prompt'));
    await expect(piVisitSignIn()).resolves.toBe(false);
    await expect(piVisitSignIn()).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledTimes(2);
  });

  it('no SDK → nothing, no throw', async () => {
    delete w.Pi;
    await expect(piVisitSignIn()).resolves.toBe(false);
  });

  it('the component runs it when the SDK reports ready', async () => {
    render(createElement(PiVisitSignIn));
    expect(authenticate).not.toHaveBeenCalled();
    await act(async () => { window.dispatchEvent(new Event('tec-pi-ready')); });
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it('the component runs it at once when the SDK was already ready', async () => {
    w.__TEC_PI_READY = true;
    await act(async () => { render(createElement(PiVisitSignIn)); });
    expect(authenticate).toHaveBeenCalledTimes(1);
  });
});
