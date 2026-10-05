/**
 * The arrival trace behind /pi-test's "Campaign arrival" panel.
 *
 * A mission that stays unticked shows nothing on a phone. Each step of the
 * arrival writes what happened to sessionStorage, so /pi-test can say which
 * step stopped — without a token, a username, or a Pi uid in the record.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import React from 'react';
import { ArrivalReport } from '../components/pioneer/ArrivalReport';
import { piVisitSignIn, __resetPiVisitSignIn } from '../lib/pi/visit-sign-in';
import { readTrace, SIGNIN_TRACE, ARRIVAL_TRACE } from '../lib/pioneer/arrival-trace';
import { ArrivalTracePanel } from '../app/pi-test/ArrivalTracePanel';

type W = { Pi?: { authenticate?: unknown }; __TEC_PI_FOREIGN_SESSION?: boolean; __TEC_PI_READY?: boolean };
const w = window as unknown as W;
const tick = () => act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });

beforeEach(() => {
  __resetPiVisitSignIn();
  sessionStorage.clear();
  delete w.__TEC_PI_FOREIGN_SESSION;
});
afterEach(() => { vi.unstubAllGlobals(); delete w.Pi; delete w.__TEC_PI_READY; });

describe('the sign-in step', () => {
  it('records a Hub-owned session — the case that never signs in here', async () => {
    w.__TEC_PI_FOREIGN_SESSION = true;
    await piVisitSignIn();
    expect(readTrace<{ result: string }>(SIGNIN_TRACE)?.result).toBe('foreign-session');
  });

  it('records a missing SDK', async () => {
    await piVisitSignIn();
    expect(readTrace<{ result: string }>(SIGNIN_TRACE)?.result).toBe('no-sdk');
  });

  it("records Pi's refusal with its message", async () => {
    w.Pi = { authenticate: vi.fn(async () => { throw new Error('user cancelled'); }) };
    await piVisitSignIn();
    expect(readTrace(SIGNIN_TRACE)).toMatchObject({ result: 'error', error: 'user cancelled' });
  });

  it('records a success — and nothing about who signed in', async () => {
    w.Pi = { authenticate: vi.fn(async () => ({ user: { uid: 'secret-uid', username: 'someone' }, accessToken: 'tok' })) };
    await piVisitSignIn();
    const raw = sessionStorage.getItem(SIGNIN_TRACE) ?? '';
    expect(JSON.parse(raw).result).toBe('ok');
    expect(raw).not.toMatch(/secret-uid|someone|tok"/);
  });
});

describe('the report step', () => {
  it("records the server's answer, including a refusal's reason", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ recorded: false, reason: 'gateway_403' }) })));
    w.Pi = { authenticate: vi.fn(async () => ({})) };
    render(<ArrivalReport />);
    await piVisitSignIn();
    await tick();
    expect(readTrace(ARRIVAL_TRACE)).toMatchObject({ status: 200, recorded: false, reason: 'gateway_403' });
  });

  it('records an HTTP failure status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
    w.Pi = { authenticate: vi.fn(async () => ({})) };
    render(<ArrivalReport />);
    await piVisitSignIn();
    await tick();
    expect(readTrace(ARRIVAL_TRACE)).toMatchObject({ status: 401, recorded: false });
  });
});

describe('/pi-test panel', () => {
  it('prints each step', async () => {
    sessionStorage.setItem('__tec_hub_entry', '1');
    sessionStorage.setItem(SIGNIN_TRACE, JSON.stringify({ at: 'x', result: 'foreign-session' }));
    render(<ArrivalTracePanel />);
    await tick();
    expect(screen.getByText('Campaign arrival')).toBeTruthy();
    expect(screen.getByText('foreign-session')).toBeTruthy();
    expect(screen.getByText('not sent')).toBeTruthy();
  });
});
