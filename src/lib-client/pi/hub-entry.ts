// ADR-007 / C-76 + C-12 §3 — hub-entry detection (single source, P1).
//
// document.referrer alone regressed when the SSO landing page (C-123 LAW 2:
// cookies only on a plain 200, never on a 3xx) replaced the old redirect
// chain: the landing's location.replace() makes the app page's referrer
// same-origin, so `isHubNavigation()` returned false for Hub-entered users.
// The apps then ran Pi.init()/Pi.authenticate() inside a Hub-owned Pi Browser
// session — poisoning it, and breaking the Hub PaymentModal (Mode 1) with
// "Pi Network SDK was not initialized".
//
// The SSO landing script now persists the signal in sessionStorage (per-tab —
// exactly the lifetime of Pi Browser session ownership). Referrer stays as a
// fallback for direct hub→app navigations that skip the landing (e.g. the
// return_url hop after a Hub payment).
import { isHubReferrer } from '@/lib/pi-network';

// The referrer test covers BOTH Hub hosts. It used to name only the Mainnet
// Hub, so a hop from the TESTNET Hub (tec-app-frontend.vercel.app) read as
// standalone and the app called Pi.authenticate() inside a session the Hub
// owns — which never answers, and surfaces only as a payment timeout with the
// Pi wallet never opening. See pi-network.ts for the full note.
export const HUB_ENTRY_KEY = '__tec_hub_entry';

export const isHubNavigation = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (window.sessionStorage.getItem(HUB_ENTRY_KEY) === '1') return true;
  } catch { /* storage unavailable — fall back to referrer */ }
  return isHubReferrer(document.referrer);
};
