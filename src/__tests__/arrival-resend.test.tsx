/**
 * The arrival is re-sent at most every 10 minutes per tab — never "once for
 * the life of the tab".
 *
 * A Pi Browser tab lives for days. When the server lost an arrival (a re-sent
 * Hub tap cleared it, tec-core-backend #378), going back to the app in the
 * same tab never reported again, and the Round 3 mission never moved (owner,
 * 2026-10-05). The old forever-flag must not block either.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { ArrivalReport } from '../components/pioneer/ArrivalReport';
import { markPiSignedIn, __resetPiVisitSignIn } from '../lib/pi/visit-sign-in';

let fetchMock: ReturnType<typeof vi.fn>;
const arrivals = () => fetchMock.mock.calls.filter((c) => String(c[0]) === '/api/bff/pioneer/arrived').length;

/** One page load: the sign-in state reset, a Pi sign-in, the reporter mounted. */
const visit = async () => {
  __resetPiVisitSignIn();
  markPiSignedIn();
  const view = render(<ArrivalReport />);
  await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
  view.unmount();
};

beforeEach(() => {
  sessionStorage.clear();
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ recorded: true }) }) as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('re-sending the arrival', () => {
  it('a second page within 10 minutes does not report again', async () => {
    await visit(); await visit();
    expect(arrivals()).toBe(1);
  });

  it('a visit 10 minutes later reports again, so a lost arrival heals', async () => {
    await visit();
    sessionStorage.setItem('tec_arrival_reported_at', String(Date.now() - 11 * 60 * 1000));
    await visit();
    expect(arrivals()).toBe(2);
  });

  it('the old forever-flag does not block', async () => {
    sessionStorage.setItem('tec_arrival_reported', '1');
    await visit();
    expect(arrivals()).toBe(1);
  });
});
