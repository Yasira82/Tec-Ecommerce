import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL
  ?? 'https://api-gateway-production-6a68.up.railway.app';

const getToken = (req: NextRequest) =>
  req.cookies.get('tec_access_token')?.value ?? '';

const getUserId = (req: NextRequest): string => {
  try {
    const raw  = req.cookies.get('tec_user')?.value ?? '';
    const user = JSON.parse(decodeURIComponent(raw));
    return user?.id ?? user?.sub ?? '';
  } catch { return ''; }
};

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const res = await fetch(
      `${GATEWAY}/api/commerce/orders?userId=${userId}&limit=20&sort=desc`,
      {
        headers: {
          Authorization:    `Bearer ${getToken(req)}`,
          'x-request-id':  crypto.randomUUID(),
          'x-internal-key': process.env.INTERNAL_SECRET ?? '',
        },
        cache: 'no-store',
      },
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body       = await req.json();
    const productId  = body.product_id  as string;
    const paymentId  = body.payment_id  as string;
    const memo       = body.memo        as string | undefined;

    if (!productId || !paymentId) {
      return NextResponse.json({ error: 'product_id and payment_id required' }, { status: 400 });
    }

    // ✅ Transform to commerce service format
    const res = await fetch(
      `${GATEWAY}/api/commerce/orders`,
      {
        method:  'POST',
        headers: {
          Authorization:    `Bearer ${getToken(req)}`,
          'Content-Type':   'application/json',
          'x-request-id':  crypto.randomUUID(),
          'x-internal-key': process.env.INTERNAL_SECRET ?? '',
        },
        body: JSON.stringify({
          items:      [{ productId, qty: 1 }],
          userId,
          payment_id: paymentId,
          memo:       memo ?? `Order for product ${productId}`,
        }),
      },
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
