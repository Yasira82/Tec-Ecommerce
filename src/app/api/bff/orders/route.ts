import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL
  ?? 'https://api-gateway-production-6a68.up.railway.app';

const getToken   = (req: NextRequest) => req.cookies.get('tec_access_token')?.value ?? '';
const getCsrf    = (req: NextRequest) => req.cookies.get('tec_csrf')?.value ?? '';

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${GATEWAY}/api/commerce/orders/buyer`, {
      headers: {
        Authorization:    `Bearer ${getToken(req)}`,
        'x-request-id':  crypto.randomUUID(),
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const csrf = req.headers.get('x-csrf-token') ?? '';
    if (!csrf || csrf !== getCsrf(req)) {
      return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
    }

    const body = await req.json();
    const res = await fetch(`${GATEWAY}/api/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        Authorization:    `Bearer ${getToken(req)}`,
        'x-request-id':  crypto.randomUUID(),
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
