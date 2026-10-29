// Server-only: which sellers are verified merchants in Zone (C-120). Zone owns the
// verdict; Ecommerce only PRESENTS it — beside a seller, never as its own claim.
//
// Fail-safe in one direction only: any error, timeout or odd answer means NO badge.
// A missing badge is a seller looking unverified for a moment; a badge shown on a guess
// would be Ecommerce asserting a trust Zone never gave (P6).

export interface ZoneMerchant { handle: string; name: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMEOUT_MS = 2500;

/** Where a buyer checks the evidence for themselves. */
export const zoneVerifyUrl = (handle: string) => `https://zone.tecosystem.app/verify/${encodeURIComponent(handle)}`;

export async function verifiedMerchants(sellerIds: unknown[]): Promise<Record<string, ZoneMerchant>> {
  const gw = process.env.API_GATEWAY_URL ?? '';
  const ids = [...new Set(sellerIds.filter((x): x is string => typeof x === 'string' && UUID.test(x)))].slice(0, 50);
  if (!gw || ids.length === 0) return {};
  try {
    const res = await fetch(`${gw}/api/identity/zone/merchants?ids=${ids.join(',')}`, {
      headers: {
        'x-request-id': crypto.randomUUID(),
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return {};
    const body = await res.json().catch(() => null) as { data?: { merchants?: Record<string, unknown> } } | null;
    const out: Record<string, ZoneMerchant> = {};
    for (const [id, m] of Object.entries(body?.data?.merchants ?? {})) {
      const v = m as { handle?: unknown; name?: unknown };
      if (ids.includes(id) && typeof v?.handle === 'string' && typeof v?.name === 'string') out[id] = { handle: v.handle, name: v.name };
    }
    return out;
  } catch {
    return {};
  }
}
