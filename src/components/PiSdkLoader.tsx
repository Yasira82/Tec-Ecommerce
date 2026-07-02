'use client';

import { useEffect } from 'react';
import { isHubNavigation } from '@/lib-client/pi/hub-entry';

export default function PiSdkLoader({ sandbox }: { sandbox: boolean }) {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_PI_APP_ID;

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
  }, [sandbox]);

  return null;
}
