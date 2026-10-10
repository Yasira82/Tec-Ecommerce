'use client';

import { useEffect, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';

/**
 * Ecommerce Testnet payout — the Pi Portal will not grant Ecommerce's Mainnet App
 * Wallet until this Testnet app has paid 5 unique wallets (tec-core-backend #410).
 * Five people open this page in the TESTNET app, sign in with Pi, and tap once; each
 * receives 0.01 Test-Pi (worth nothing). Pi must be asked for `wallet_address`, or it
 * has nowhere to send (audits/A2U_FIRST_PAYOUT_ROUND_2026-09-13.md §2).
 *
 * ADR-007: in a Hub-owned session Pi.authenticate never answers — say so instead.
 */

type PiWindow = {
  __TEC_PI_FOREIGN_SESSION?: boolean;
  Pi?: { authenticate?: (scopes: string[], onIncomplete: (p: unknown) => void) => Promise<{ accessToken?: string }> };
};

const csrf = (): string =>
  document.cookie.split('; ').find((r) => r.startsWith('tec_csrf='))?.split('=')[1] ?? '';

const TESTNET = /\.vercel\.app$|-test\.tecosystem\.app$/i;

export default function TestnetPayoutPage() {
  const [testnet, setTestnet] = useState<boolean | null>(null);
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { setTestnet(TESTNET.test(window.location.hostname)); }, []);

  const claim = async () => {
    setBusy(true); setMsg(null);
    try {
      const w = window as unknown as PiWindow;
      if (w.__TEC_PI_FOREIGN_SESSION === true) throw new Error('Open this page directly in the Ecommerce Testnet app, not from the Hub.');
      if (typeof w.Pi?.authenticate !== 'function') throw new Error('Open this page in Pi Browser.');
      const auth = await w.Pi.authenticate(['username', 'payments', 'wallet_address'], () => { /* no payment to resume here */ });
      if (!auth?.accessToken) throw new Error('Pi did not sign you in.');
      const res = await fetch('/api/bff/testnet-payout', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify({ pi_access_token: auth.accessToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? `Failed (${res.status})`);
      setMsg({ ok: true, text: data?.data?.already ? 'You have already received your test payout. Thank you!' : 'Sent — 0.01 Test-Pi is on its way to your Testnet wallet. Thank you!' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: TEC_COLORS.bg, color: '#fff', padding: '32px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Ecommerce · Testnet payout</h1>
        {testnet === false ? (
          <p style={{ color: '#aaa', fontSize: 14 }}>This page only works in the Ecommerce <b>Testnet</b> app.</p>
        ) : (
          <>
            <p style={{ color: '#aaa', fontSize: 14, lineHeight: 1.6 }}>
              Help TEC Ecommerce get its Mainnet wallet: sign in with Pi and receive <b>0.01 Test-Pi</b> (Testnet coins,
              no real value). One per person. Pi will ask to share your wallet address — that is where the Test-Pi goes.
            </p>
            <button type="button" onClick={() => { void claim(); }} disabled={busy || testnet === null}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 15, background: TEC_COLORS.gold, color: '#000', opacity: busy ? 0.5 : 1, marginTop: 8 }}>
              {busy ? 'Sending…' : 'Sign in with Pi and receive 0.01 Test-Pi'}
            </button>
            {msg && <p role="status" style={{ marginTop: 12, fontSize: 14, color: msg.ok ? TEC_COLORS.green : TEC_COLORS.red }}>{msg.text}</p>}
          </>
        )}
      </div>
    </main>
  );
}
