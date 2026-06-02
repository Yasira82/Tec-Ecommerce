import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                  from 'jose';

export async function GET(req: NextRequest) {
  const token    = req.nextUrl.searchParams.get('token');
  const redirect = req.nextUrl.searchParams.get('redirect') ?? '/shop';

  console.log('[sso-callback] token:', token ? 'present' : 'MISSING');
  console.log('[sso-callback] redirect:', redirect);

  if (!token) {
    console.error('[sso-callback] NO TOKEN');
    return NextResponse.redirect(new URL('/shop', req.url));
  }

  const secret = process.env.SSO_SECRET;
  if (!secret) {
    console.error('[sso-callback] NO SSO_SECRET');
    return NextResponse.redirect(new URL('/shop', req.url));
  }

  try {
    const encoded = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encoded, {
      algorithms: ['HS256'],
      issuer:     'tec.pi',
    });

    const accessToken = payload['accessToken'] as string;
    const user        = payload['user'] as Record<string, unknown>;

    console.log('[sso-callback] verified OK, user:', user?.piUsername ?? 'unknown');

    if (!accessToken || !user) {
      console.error('[sso-callback] NO accessToken or user in payload');
      return NextResponse.redirect(new URL('/shop', req.url));
    }

    const csrf       = crypto.randomUUID();
    const userJson   = encodeURIComponent(JSON.stringify(user));
    const redirectTo = redirect.startsWith('/') ? redirect : '/shop';
    const response   = NextResponse.redirect(new URL(redirectTo, req.url));

    const cookieDomain =
      process.env.COOKIE_DOMAIN ??
      process.env.NEXT_PUBLIC_SSO_DOMAIN ??
      undefined;

    console.log('[sso-callback] cookieDomain:', cookieDomain);

    const cookieOpts = {
      secure:   true,
      sameSite: 'none' as const,
      path:     '/',
      domain:   cookieDomain,
    };

    response.cookies.set('tec_access_token', accessToken, { ...cookieOpts, httpOnly: false, maxAge: 60 * 60 * 24 });
    response.cookies.set('tec_user',         userJson,    { ...cookieOpts, httpOnly: false, maxAge: 60 * 60 * 24 });
    response.cookies.set('tec_csrf',         csrf,        { ...cookieOpts, httpOnly: false, maxAge: 60 * 60 * 24 });

    console.log('[sso-callback] cookies set, redirecting to:', redirectTo);
    return response;
  } catch (err) {
    console.error('[sso-callback] ERROR:', err);
    return NextResponse.redirect(new URL('/shop', req.url));
  }
}
