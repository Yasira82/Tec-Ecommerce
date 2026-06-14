import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_ROUTES  = ['/shop', '/orders', '/profile'];
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_PROTECTED    = ['/api/bff/orders'];
const CSRF_EXCLUDED     = ['/api/bff/payment/'];

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method       = req.method.toUpperCase();

  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  if (isProtected) {
    const token = req.cookies.get('tec_access_token')?.value;
    if (!token || token.trim() === '') {
      const loginUrl = new URL('/', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (!CSRF_SAFE_METHODS.has(method)) {
    const isExcluded      = CSRF_EXCLUDED.some(r => pathname.startsWith(r));
    const isCsrfProtected = !isExcluded && CSRF_PROTECTED.some(r => pathname.startsWith(r));

    if (isCsrfProtected) {
      const csrfCookie = req.cookies.get('tec_csrf')?.value ?? '';
      const csrfHeader = req.headers.get('x-csrf-token') ?? '';
      // Only reject when cookie IS present but header doesn't match.
      // Absent cookie = not bridged from Hub SSO to this domain yet;
      // Bearer token still authenticates the request.
      if (csrfCookie && !timingSafeStringEqual(csrfCookie, csrfHeader)) {
        return NextResponse.json(
          { error: 'Invalid CSRF token', code: 'CSRF_INVALID' },
          { status: 403 },
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/shop/:path*', '/orders/:path*', '/profile/:path*', '/api/bff/:path*'],
};
