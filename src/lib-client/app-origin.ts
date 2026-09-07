/**
 * The origin to hand the Hub — for a login return, and for a Mode-1 payment
 * return — read from the LIVE host rather than from a build-time constant.
 *
 * One build serves two Pi apps on two hosts: `ecommerce.tecosystem.app` (the
 * Mainnet app) and Ecommerce's `*.vercel.app` project host (the paired Testnet
 * one). `NEXT_PUBLIC_APP_URL` is inlined at build time and is therefore the
 * same string on both — by construction it can only ever name one of the two.
 *
 * The failure it causes is silent: a Testnet visitor is handed to the Hub with
 * the MAINNET return address. The Hub signs them in perfectly and returns them
 * to the other origin, where the session then lives. The Testnet host stays
 * "Unauthorized" forever, and nothing appears in any log — because nothing
 * failed. Same for a Mode-1 payment: the π moves, and the buyer lands on the
 * wrong host with no order.
 *
 * Nothing is weakened. This is the origin the page was SERVED from, which a
 * visitor cannot forge, and the Hub validates every target against its own
 * ALLOWED_TARGETS regardless.
 *
 * It lives in ONE file on purpose: this app had the constant redeclared in
 * eight, and a per-file copy is how the login page and the app page drifted
 * apart in Commerce.
 */
const CONFIGURED_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';

/** The origin actually being served — the configured one only during SSR. */
export const appOrigin = (): string =>
  typeof window === 'undefined' ? CONFIGURED_APP_URL : window.location.origin;

/** `appOrigin()` with a path appended, e.g. `appUrl('/orders')`. */
export const appUrl = (path = ''): string => `${appOrigin()}${path}`;
