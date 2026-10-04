/**
 * F3 (tec-template-base #47): count a visit the way Pi counts it.
 *
 * For a `.pi` domain, Pi counts KYC'd Pioneers who SIGNED IN WITH PI in this app.
 * The arrival report fired on page load — before, and without, any handshake — so
 * coverage read 5/5 while Pi said "Requirements Not Met", and Hub-grid opens (a
 * Hub-owned session, ADR-007) were counted too. Now it waits for this app's own
 * Pi sign-in: the visit sign-in's handshake, or the app's login.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { ArrivalReport } from '../components/pioneer/ArrivalReport';
import { piVisitSignIn, markPiSignedIn, __resetPiVisitSignIn } from '../lib/pi/visit-sign-in';

type W = { Pi?: { authenticate?: unknown }; __TEC_PI_FOREIGN_SESSION?: boolean };
const w = window as unknown as W;
let fetchMock: ReturnType<typeof vi.fn>;
const arrivals = () => fetchMock.mock.calls.filter((c) => String(c[0]) === '/api/bff/pioneer/arrived').length;
const tick = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  __resetPiVisitSignIn();
  sessionStorage.clear();
  delete w.__TEC_PI_FOREIGN_SESSION;
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ recorded: true }) }) as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); delete w.Pi; });

describe('an arrival is reported only after this app\'s own Pi sign-in', () => {
  it('a page load alone reports nothing', async () => {
    w.Pi = { authenticate: vi.fn(() => new Promise(() => { /* Pi has not answered */ })) };
    render(<ArrivalReport />);
    void piVisitSignIn();
    await tick();
    expect(arrivals()).toBe(0);
  });

  it('reports once Pi answers the visit sign-in — and only once', async () => {
    w.Pi = { authenticate: vi.fn(async () => ({ accessToken: 't' })) };
    render(<ArrivalReport />);
    await act(async () => { await piVisitSignIn(); });
    await tick();
    expect(arrivals()).toBe(1);
    await act(async () => { await piVisitSignIn(); markPiSignedIn(); });
    expect(arrivals()).toBe(1);
  });

  it('the app\'s own login counts as a sign-in here', async () => {
    render(<ArrivalReport />);
    await act(async () => { markPiSignedIn(); });
    await tick();
    expect(arrivals()).toBe(1);
  });

  it('Pi refusing the handshake reports nothing', async () => {
    w.Pi = { authenticate: vi.fn(async () => { throw new Error('cancelled'); }) };
    render(<ArrivalReport />);
    await act(async () => { await piVisitSignIn(); });
    expect(arrivals()).toBe(0);
  });

  it('a Hub-owned session (opened from the Hub grid) never signs in here, so it is not counted', async () => {
    w.__TEC_PI_FOREIGN_SESSION = true;
    const authenticate = vi.fn();
    w.Pi = { authenticate };
    render(<ArrivalReport />);
    await act(async () => { await piVisitSignIn(); });
    expect(authenticate).not.toHaveBeenCalled();
    expect(arrivals()).toBe(0);
  });
});
