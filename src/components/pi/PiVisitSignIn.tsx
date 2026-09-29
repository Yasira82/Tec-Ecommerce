'use client';

// Renders nothing. Runs the visit sign-in (lib/pi/visit-sign-in.ts) as soon as
// the Pi SDK is ready — the same moment tec-template-base's PiWarmup does.

import { useEffect } from 'react';
import { piVisitSignIn } from '@/lib/pi/visit-sign-in';

export function PiVisitSignIn() {
  useEffect(() => {
    const w = window as unknown as { __TEC_PI_READY?: boolean };
    const run = () => { void piVisitSignIn(); };
    if (w.__TEC_PI_READY === true) { run(); return; }
    window.addEventListener('tec-pi-ready', run, { once: true });
    return () => window.removeEventListener('tec-pi-ready', run);
  }, []);
  return null;
}
