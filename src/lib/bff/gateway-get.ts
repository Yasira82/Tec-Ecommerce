// C-123-adjacent resilience: the Railway backend cold-starts — the first hit
// after idle can 502/504 or drop the connection, then the next succeeds. For
// IDEMPOTENT GETs only, absorb exactly one such blip with a short backoff.
// Never used for POST/mutations (no double-submit risk).
export async function gatewayGet(url: string, init: RequestInit = {}): Promise<Response> {
  const attempt = () => fetch(url, { ...init, method: 'GET', cache: 'no-store' });
  try {
    const res = await attempt();
    if (res.status !== 502 && res.status !== 504) return res;
    await new Promise(r => setTimeout(r, 900));
    return attempt();
  } catch {
    await new Promise(r => setTimeout(r, 900));
    return attempt();
  }
}
