import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                  from 'jose';

export async function GET(req: NextRequest) {
  try {
    const token    = req.nextUrl.searchParams.get('token');
    const redirect = req.nextUrl.searchParams.get('redirect') ?? '/shop';

    if (!token) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    const secret = process.env.SSO_SECRET;
    if (!secret) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    const encoded = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encoded, {
      algorithms: ['HS256'],
      issuer:     'tec.pi',
    });

    const accessToken = payload['accessToken'] as string;
    const user        = payload['user'] as Record<string, unknown>;

    if (!accessToken || !user) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    const csrf       = crypto.randomUUID();
    const userJson   = encodeURIComponent(JSON.stringify(user));
    const redirectTo = redirect.startsWith('/') ? redirect : '/shop';
    const response   = NextResponse.redirect(new URL(redirectTo, req.url));

    const cookieDomain =
      process.env.COOKIE_DOMAIN ??
      process.env.NEXT_PUBLIC_SSO_DOMAIN ??
      undefined;

    const cookieOpts = {
      secure:   true,
      sameSite: 'none' as const,
      path:     '/',
      domain:   cookieDomain,
    };

    response.cookies.set('tec_access_token', accessToken, { ...cookieOpts, httpOnly: false, maxAge: 60 * 60 * 24 });
    response.cookies.set('tec_user',         userJson,    { ...cookieOpts, httpOnly: false, maxAge: 60 * 60 * 24 });
    response.cookies.set('tec_csrf',         csrf,        { ...cookieOpts, httpOnly: false, maxAge: 60 * 60 * 24 });

    return response;
  } catch {
    return NextResponse.redirect(new URL('/', req.url));
  }
}
