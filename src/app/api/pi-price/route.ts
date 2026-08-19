import { NextResponse } from 'next/server';

// GET /api/pi-price — the live Pi/USD market rate, server-side + cached.
// Used to show an "≈ $Y (market)" reference next to π prices. Purchases are made
// in real Pi (Pi SDK U2A), so the market rate is an honest reference — NOT a
// second currency. Fails SAFE: on any error it returns { usd: null } so the UI
// simply hides the estimate (never shows $0 or a stale/wrong number).
//
// One server-side source + a short cache = clients don't each hammer the price
// API (rate limits) and the source can be swapped in ONE place later (e.g. OKX).

export const runtime = 'nodejs';

const SOURCE =
  'https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd';
const TTL_MS = 60_000; // 60s cache

let cache: { usd: number | null; at: number } = { usd: null, at: 0 };

async function fetchPiUsd(): Promise<number | null> {
  try {
    const res = await fetch(SOURCE, {
      headers: { accept: 'application/json' },
      // let our own cache govern; don't trust upstream caching semantics
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { 'pi-network'?: { usd?: number } };
    const usd = data?.['pi-network']?.usd;
    return typeof usd === 'number' && Number.isFinite(usd) && usd > 0 ? usd : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const now = Date.now();
  if (cache.usd !== null && now - cache.at < TTL_MS) {
    return NextResponse.json({ usd: cache.usd, source: 'market', cached: true });
  }
  const usd = await fetchPiUsd();
  // Only overwrite the cache with a good value; keep the last good one on failure
  // so a transient upstream blip doesn't blank the estimate for everyone.
  if (usd !== null) cache = { usd, at: now };
  return NextResponse.json({ usd: cache.usd, source: 'market', cached: false });
}
