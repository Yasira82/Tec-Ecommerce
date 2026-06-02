import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                  from 'jose';

export async function GET(req: NextRequest) {
  const token    = req.nextUrl.searchParams.get('token');
  const redirect = req.nextUrl.searchParams.get('redirect') ?? '/shop';

  if (!token) return NextResponse.redirect(new URL('/shop', req.url));

  const secret = process.env.SSO_SECRET;
  if (!secret) return NextResponse.redirect(new URL('/shop', req.url));

  try {
    const encoded = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encoded, {
      algorithms: ['HS256'],
      issuer:     'tec.pi',
    });

    const accessToken = payload['accessToken'] as string;
    const user        = payload['user'] as Record<string, unknown>;

    if (!accessToken || !user) {
      return NextResponse.redirect(new URL('/shop', req.url));
    }

    const csrf       = crypto.randomUUID();
    const userJson   = JSON.stringify(user);
    const redirectTo = redirect.startsWith('/') ? redirect : '/shop';

    // ✅ Set cookies via JavaScript + client redirect
    // This ensures browser processes cookies before navigation
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body>
<script>
  document.cookie = "tec_access_token=${accessToken}; path=/; max-age=86400; secure; samesite=none";
  document.cookie = "tec_user=${encodeURIComponent(userJson)}; path=/; max-age=86400; secure; samesite=none";
  document.cookie = "tec_csrf=${csrf}; path=/; max-age=86400; secure; samesite=none";
  window.location.href = "${redirectTo}";
</script>
</body></html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch {
    return NextResponse.redirect(new URL('/shop', req.url));
  }
}
