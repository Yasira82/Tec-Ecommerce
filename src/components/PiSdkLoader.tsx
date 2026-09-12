'use client';

import { useEffect } from 'react';
import { isHubNavigation } from '@/lib-client/pi/hub-entry';

/**
 * `sandbox` is Pi's SANDBOX ENVIRONMENT, which is not the same thing as the
 * Testnet. Three separate axes, and conflating them cost this platform days:
 *
 *   the HOST     picks which Pi APP the browser is talking to
 *   that app's   API KEY picks which NETWORK Pi settles on
 *   `sandbox`    points the SDK at Pi's Sandbox environment entirely
 *
 * So the paired Testnet app must run with `sandbox: false` like any other —
 * turning it on silenced the Pi bridge and every payment hung on
 * "Confirm in Pi…". It stays available on the Testnet host behind an explicit
 * `?pi_sandbox=1`, for the rare case someone actually wants Pi's Sandbox.
 *
 * The Mainnet host is untouched: it keeps whatever the build was configured
 * with (`false` in production).
 */
const resolveSandbox = (configured: boolean): boolean => {
  if (typeof window === 'undefined') return configured;
  const isTestnetHost = /\.vercel\.app$/i.test(window.location.hostname) || /-test\.tecosystem\.app$/i.test(window.location.hostname) || /-test\.tecosystem\.app$/i.test(window.location.hostname);
  if (!isTestnetHost) return configured;
  try {
    return new URLSearchParams(window.location.search).get('pi_sandbox') === '1';
  } catch {
    return false;
  }
};

export default function PiSdkLoader({ sandbox: configured }: { sandbox: boolean }) {
  useEffect(() => {
    const appId   = process.env.NEXT_PUBLIC_PI_APP_ID;
    const sandbox = resolveSandbox(configured);

    // ADR-007/C-12 §3: Hub-entered = Hub owns this Pi Browser session.
    // Calling Pi.init() here poisons it and breaks the Hub PaymentModal
    // (Mode 1). Same terminal state as the "already initialized" catch below.
    if (isHubNavigation()) {
      (window as any).__TEC_PI_FOREIGN_SESSION = true;
      window.__TEC_PI_READY = true;
      window.dispatchEvent(new Event('tec-pi-ready'));
      return;
    }

    const tryInit = (): boolean => {
      if (typeof window.Pi === 'undefined') return false;
      try {
        window.Pi.init({ version: '2.0', sandbox, ...(appId ? { appId } : {}) });
      } catch (e) {
        const msg = e instanceof Error ? e.message.toLowerCase() : '';
        if (msg.includes('already') || msg.includes('initialized')) {
          (window as any).__TEC_PI_FOREIGN_SESSION = true;
        } else {
          return false;
        }
      }
      window.__TEC_PI_READY = true;
      window.dispatchEvent(new Event('tec-pi-ready'));
      return true;
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) { window.__TEC_PI_READY = false; tryInit(); }
    };
    window.addEventListener('pageshow', onPageShow);
    if (tryInit()) return () => window.removeEventListener('pageshow', onPageShow);

    const poll = setInterval(() => { if (tryInit()) clearInterval(poll); }, 100);
    return () => { clearInterval(poll); window.removeEventListener('pageshow', onPageShow); };
  }, [configured]);

  return null;
}
