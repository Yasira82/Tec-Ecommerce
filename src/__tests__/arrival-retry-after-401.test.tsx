/**
 * The arrival report fires the moment Pi signs the visitor in — which can come BEFORE
 * this app has a fresh TEC session (an expired one, or a visitor straight from Pi whom
 * the app signs in a moment later). The first report then got 401 and nothing asked
 * again (owner's phone, Assets /pi-test, 15 Nov 2026: `HTTP 401 · recorded false` on
 * the first visit, `HTTP 200 · recorded true` on the next).
 *
 * A 401 is now asked again after 3 s and 10 s, then left. Any other answer is final.
 * (tec-template-base 7ff7a0f; this app's reporter waits on `onPiSignedIn`.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { ArrivalReport } from '../components/pioneer/ArrivalReport';
import { markPiSignedIn, __resetPiVisitSignIn } from '../lib/pi/visit-sign-in';

const answer = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;
let fetchMock: ReturnType<typeof vi.fn>;
const arrivals = () => fetchMock.mock.calls.filter((c) => String(c[0]) === '/api/bff/pioneer/arrived').length;

const start = async () => {
  __resetPiVisitSignIn();
  markPiSignedIn();
  render(<ArrivalReport />);
  await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
};
const wait = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: false }); sessionStorage.clear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('an arrival refused for want of a session is asked again', () => {
  it('401, then the session exists → recorded on the retry', async () => {
    fetchMock = vi.fn().mockResolvedValueOnce(answer(401)).mockResolvedValue(answer(200, { recorded: true }));
    vi.stubGlobal('fetch', fetchMock);
    await start();
    expect(arrivals()).toBe(1);
    await wait(3_000);
    expect(arrivals()).toBe(2);
    expect(Number(sessionStorage.getItem('tec_arrival_reported_at'))).toBeGreaterThan(0);
    await wait(30_000);
    expect(arrivals()).toBe(2);
  });

  it('gives up after two retries — a signed-out visitor is not chased', async () => {
    fetchMock = vi.fn().mockResolvedValue(answer(401));
    vi.stubGlobal('fetch', fetchMock);
    await start();
    await wait(60_000);
    expect(arrivals()).toBe(3);
  });

  it('any answer but 401 is final', async () => {
    fetchMock = vi.fn().mockResolvedValue(answer(200, { recorded: false, reason: 'gateway_403' }));
    vi.stubGlobal('fetch', fetchMock);
    await start();
    await wait(60_000);
    expect(arrivals()).toBe(1);
  });
});
