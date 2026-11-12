import { NextRequest, NextResponse } from 'next/server';
import { cookieDomainFor } from '@/lib/cookie-domain';
import {
  ACCESS_COOKIE, REFRESH_COOKIE, refreshesOn, needsRefresh, refreshAtGateway, writeRotated, dropRefresh,
} from '@/lib/session-refresh';

const PROTECTED_ROUTES  = ['/shop', '/orders', '/profile'];
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_PROTECTED    = [
  '/api/auth/refresh',
  '/api/bff/orders',
  '/api/bff/payment',
  '/api/payment',
];

// Double-submit CSRF token cookie. Not a secret — same-origin policy stops
// cross-origin attackers from reading it. httpOnly:false so client JS can
// echo it back in the x-csrf-token header.
const CSRF_COOKIE_OPTS = {
  httpOnly: false,
  secure:   true,
  sameSite: 'none' as const,
  partitioned: true,
  path:     '/',
  maxAge:   60 * 60 * 24,
};

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

// CSRF: a state-changing request is trusted if EITHER the double-submit token
// matches OR it is first-party (same-origin / a *.tecosystem.app origin).
// Pure double-submit proved unreliable across SSO domains and inside Pi Browser
// (sameSite=None cookies get dropped) → legit payment POSTs 403'd. Verifying
// the Origin is an OWASP-recommended, cookie-independent CSRF defense; a
// cross-site attacker cannot forge the browser-set Origin header.
function isTrustedCsrf(req: NextRequest): boolean {
  const cookie = req.cookies.get('tec_csrf')?.value ?? '';
  const header = req.headers.get('x-csrf-token') ?? '';
  if (cookie && header && timingSafeStringEqual(cookie, header)) return true;

  const host   = req.headers.get('host') ?? '';
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const oh = new URL(origin).host;
      if (oh === host || oh.endsWith('.tecosystem.app')) return true;
    } catch { /* malformed Origin → not trusted */ }
  }
  return false;
}

// ── Session refresh (C-123 §4) — refreshSessionIfNeeded ───────────────────
// Before a BFF call or the session check, an access token that has expired (or is
// about to) is renewed with the refresh token, on the server, once per token. The
// route then runs with the NEW token, and the rotated cookies ride this response.
// Any failure leaves the request exactly as it came (§4: never a logout).
async function refreshSessionIfNeeded(req: NextRequest): Promise<NextResponse> {
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  const secret  = process.env.JWT_SECRET;
  const gateway = process.env.API_GATEWAY_URL;
  if (!refresh || !secret || !gateway || !refreshesOn(req.nextUrl.pathname)) return NextResponse.next();
  if (!(await needsRefresh(req.cookies.get(ACCESS_COOKIE)?.value, secret))) return NextResponse.next();

  const out = await refreshAtGateway(refresh, gateway);
  if (out === 'unavailable') return NextResponse.next();
  if (out === 'rejected') {
    const res = NextResponse.next();
    dropRefresh(res.cookies);
    return res;
  }
  // The route reads the token from the request cookies: hand it the new one.
  req.cookies.set(ACCESS_COOKIE, out.token);
  if (out.refreshToken) req.cookies.set(REFRESH_COOKIE, out.refreshToken);
  const res = NextResponse.next({ request: { headers: req.headers } });
  const domain = cookieDomainFor(
    req.nextUrl.hostname,
    process.env.COOKIE_DOMAIN ?? process.env.NEXT_PUBLIC_SSO_DOMAIN ?? undefined,
  );
  writeRotated(res.cookies, out, domain, (name) => req.cookies.get(name)?.value);
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method       = req.method.toUpperCase();

  // ── Page auth guard ──────────────────────────────────────
  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  if (isProtected) {
    const token = req.cookies.get('tec_access_token')?.value;
    if (!token || token.trim() === '') {
      const loginUrl = new URL('/', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      // Carry the Hub-surface marker across the sign-in hop.
      //
      // A first visit arrives as `/app?q=1`, has no session, and is sent here —
      // and the query died on that redirect, so the one visitor who needs a way
      // back (the one who just had to sign in) was the only one who never got it.
      // `QuestReturn` reads it on the landing page below.
      //
      // Matched against the closed set it knows — `1` the Founding Quest, `2` the
      // reward campaign — and re-emitted as a literal. This value decides a link
      // the app renders, so it is never copied through.
      const q = req.nextUrl.searchParams.get('q');
      if (q === '1' || q === '2') loginUrl.searchParams.set('q', q);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Unsafe method → CSRF (double-submit OR first-party origin) ────────
  if (!CSRF_SAFE_METHODS.has(method)) {
    const isCsrfProtected = CSRF_PROTECTED.some(r => pathname.startsWith(r));
    if (isCsrfProtected && !isTrustedCsrf(req)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token', code: 'CSRF_INVALID' },
        { status: 403 },
      );
    }
    return refreshSessionIfNeeded(req);
  }

  // ── Safe method → ensure a tec_csrf cookie exists ────────
  // Self-mints the double-submit token on any page load. Per-origin —
  // no cross-domain cookie sharing required (apps are on separate domains).
  const res = await refreshSessionIfNeeded(req);
  if (!req.cookies.get('tec_csrf')?.value) {
    res.cookies.set('tec_csrf', crypto.randomUUID(), CSRF_COOKIE_OPTS);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
