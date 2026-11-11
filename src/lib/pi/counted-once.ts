// Count a visitor once — not on every visit.
//
// The visit sign-in (visit-sign-in.ts) exists so Pi sees a Pioneer sign in with
// Pi IN this app: that is what counts toward the app's `.pi` domain (5 unique
// KYC'd Pioneers). Pi counts PEOPLE, so a second, third, tenth visit by the same
// person adds nothing to that count.
//
// What every repeat handshake did add (owner, 10 Nov 2026): after a few apps
// opened from the Hub in one Pi Browser session, each signing in with its own
// App ID, Pi's wallet stopped opening for ANY app until Pi Browser was closed
// and reopened. Payments had been reliable until the campaign made every visit
// sign in. Owner's rule: "each user is counted as one visit, not every time".
//
// So: once Pi has signed a username in here, this device remembers it and later
// visits by that username skip the visit handshake. A visitor we cannot name
// yet (no TEC session) still signs in — that is also how they log in
// (self-sign-in.ts). A payment always authenticates at the tap; nothing here
// touches that path.

const KEY = '__tec_pi_counted';

const read = (): string[] => {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
};

/** Has Pi already signed this username in on this device, in this app? */
export function wasCounted(username: string | null | undefined): boolean {
  if (!username) return false;
  return read().includes(username.toLowerCase());
}

/** Remember that Pi signed this username in here. Never throws. */
export function rememberCounted(username: string | null | undefined): void {
  if (!username) return;
  const u = username.toLowerCase();
  try {
    const list = read();
    if (list.includes(u)) return;
    window.localStorage.setItem(KEY, JSON.stringify([...list, u].slice(-20)));
  } catch { /* storage unavailable: the next visit signs in again, as before */ }
}

/** The signed-in TEC username, read server-side (Pi Browser hides tec_user from JS — C-123 §3). */
export async function currentUsername(): Promise<string | null> {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
    if (!r.ok) return null;
    const d = (await r.json()) as { authenticated?: boolean; user?: { username?: unknown; piUsername?: unknown } };
    const u = d?.authenticated ? (d.user?.piUsername ?? d.user?.username) : null;
    return typeof u === 'string' && u ? u : null;
  } catch { return null; }
}
