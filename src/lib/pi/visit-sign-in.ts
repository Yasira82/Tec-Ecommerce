// Sign in with Pi on a visit — once per page load, never in a Hub-owned session.
//
// Why this exists: Pi grants a `.pi` domain once 5 unique KYC'd Pioneers *engage
// with the app*, and what it can see is a Pi sign-in (`Pi.authenticate`) inside
// THIS app. A visitor arriving from the Hub already shows their username — that
// comes from the Hub's SSO cookie, not from Pi — so a visit that never reached
// Pi.authenticate counted for nobody. On 2026-09-29, after round 2 of the reward
// campaign, this app was "Requirements Not Met" while its coverage said 5/5; the
// apps built from tec-template-base, which authenticate on every standalone visit
// (PiWarmup), were the ones whose claims opened.
//
// ADR-007: in a Hub-owned session (`__TEC_PI_FOREIGN_SESSION`) Pi.authenticate
// never answers and poisons the Hub's payment modal — never call it there.
//
// Silent by design. Nobody asked for this handshake; a failure must never show an
// error. The incomplete-payment callback is a no-op on purpose: the payment path
// authenticates again at the tap, with its own resolver, and handles it there.

type PiWindow = {
  __TEC_PI_FOREIGN_SESSION?: boolean;
  Pi?: { authenticate?: (scopes: string[], onIncomplete: (p: unknown) => void) => Promise<unknown> };
};

let inflight: Promise<boolean> | null = null;
let signedIn = false;

/** Resolves true once Pi has signed this visitor in here; never throws, never runs twice at once. */
export function piVisitSignIn(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const w = window as unknown as PiWindow;
  if (w.__TEC_PI_FOREIGN_SESSION === true) return Promise.resolve(false);
  if (signedIn) return Promise.resolve(true);
  if (inflight) return inflight;
  const authenticate = w.Pi?.authenticate;
  if (typeof authenticate !== 'function') return Promise.resolve(false);

  inflight = Promise.resolve()
    .then(() => authenticate.call(w.Pi, ['username', 'payments'], () => { /* see header */ }))
    .then(() => { signedIn = true; return true; })
    .catch(() => false)
    .finally(() => { inflight = null; });
  return inflight;
}

/** Tests only. */
export function __resetPiVisitSignIn(): void {
  inflight = null;
  signedIn = false;
}
