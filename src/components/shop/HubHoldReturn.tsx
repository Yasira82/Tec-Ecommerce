'use client';

import { useEffect } from 'react';
import { settleHubHoldOnReturn } from '@/lib-client/orders/hub-hold';

/** Back from paying at the Hub: confirm the held order, or put its units back. */
export function HubHoldReturn() {
  useEffect(() => { void settleHubHoldOnReturn(window.location.search); }, []);
  return null;
}
