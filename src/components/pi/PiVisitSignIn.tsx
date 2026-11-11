'use client';

// Renders nothing. Runs the visit sign-in (lib/pi/visit-sign-in.ts) as soon as
// the Pi SDK is ready — the same moment tec-template-base's PiWarmup does.

import { useEffect } from 'react';
import { piVisitSignIn, piUsername, markPiSignedIn } from '@/lib/pi/visit-sign-in';
import { wasCounted, rememberCounted, currentUsername } from '@/lib/pi/counted-once';

// Once per person, not per visit (lib/pi/counted-once.ts): a username Pi has
// already signed in here skips the handshake. Exported for tests.
export async function visitSignInOnce(): Promise<'counted-before' | 'signed-in' | 'not-signed-in'> {
  const who = await currentUsername();
  if (wasCounted(who)) {
    // Pi already signed this person in HERE (that is the only way onto the
    // list), so the campaign's arrival report (ArrivalReport, onPiSignedIn)
    // still fires — a Round 3 mission must tick on a repeat visit too. Only
    // the handshake is skipped, not the bookkeeping.
    markPiSignedIn();
    return 'counted-before';
  }
  const ok = await piVisitSignIn();
  if (!ok) return 'not-signed-in';
  rememberCounted(piUsername() ?? who);
  return 'signed-in';
}

export function PiVisitSignIn() {
  useEffect(() => {
    const w = window as unknown as { __TEC_PI_READY?: boolean };
    const run = () => { void visitSignInOnce(); };
    if (w.__TEC_PI_READY === true) { run(); return; }
    window.addEventListener('tec-pi-ready', run, { once: true });
    return () => window.removeEventListener('tec-pi-ready', run);
  }, []);
  return null;
}
