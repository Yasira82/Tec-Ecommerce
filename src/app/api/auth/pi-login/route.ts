import { NextRequest, NextResponse } from 'next/server';
import { cookieDomainFor } from '@/lib/cookie-domain';

const GW = process.env.API_GATEWAY_URL;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${GW}/api/v1/auth/pi-login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    const user  = data?.user;
    const token = data?.tokens?.accessToken ?? data?.token;
    const refresh = data?.tokens?.refreshToken;

    if (!token || !user) {
      return NextResponse.json(data, { status: res.status });
    }

    const csrf     = crypto.randomUUID();
    // Raw JSON: `cookies.set` encodes the value itself. Encoding it here too put
    // `%257B…` in the browser, and getStoredUser() (one decode) read nobody.
    const userJson = JSON.stringify(user);

    // Host-only wherever the configured domain does not cover this host (cookie-domain.ts).
    // On the Testnet host `tec-ecommerce.vercel.app` a `.tecosystem.app` cookie is dropped
    // silently: sign-in succeeded and the next request still said "Sign in first"
    // (owner, 2026-10-10 — every Pi account but the one already signed in).
    const cookieDomain = cookieDomainFor(
      req.nextUrl.hostname,
      process.env.COOKIE_DOMAIN ?? process.env.NEXT_PUBLIC_SSO_DOMAIN ?? undefined,
    );

    const cookieOpts = {
      secure:   true,
      sameSite: 'none' as const,
      partitioned: true,
      path:     '/',
      domain:   cookieDomain,
      maxAge:   60 * 60 * 24,
    };

    const response = NextResponse.json(data, { status: 200 });

    response.cookies.set('tec_access_token', token,     { ...cookieOpts, httpOnly: false });
    response.cookies.set('tec_user',         userJson,  { ...cookieOpts, httpOnly: false });
    response.cookies.set('tec_csrf',         csrf,      { ...cookieOpts, httpOnly: false });
    if (refresh) {
      response.cookies.set('tec_refresh_token', refresh, { ...cookieOpts, httpOnly: true });
    }

    return response;
  } catch {
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}
