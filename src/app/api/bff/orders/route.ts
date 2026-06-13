import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL;

const getToken = (req: NextRequest) =>
  req.cookies.get('tec_access_token')?.value ?? '';

const getUserId = (req: NextRequest): string => {
  try {
    const raw  = req.cookies.get('tec_user')?.value ?? '';
    const user = JSON.parse(decodeURIComponent(raw));
    // try all common field names used across Hub / auth-service versions
    return user?.id ?? user?.sub ?? user?.uid ?? user?.userId ?? user?.piUid ?? '';
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
          'x-user-id':      userId,
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
    const productId  = body.product_id as string | undefined;
    const paymentId  = body.payment_id as string;
    const memo       = body.memo       as string | undefined;
    const bodyItems  = body.items      as { productId: string; qty: number }[] | undefined;

    if (!paymentId || (!productId && !bodyItems?.length)) {
      return NextResponse.json({ error: 'payment_id and either product_id or items[] required' }, { status: 400 });
    }

    const items = bodyItems ?? [{ productId: productId!, qty: 1 }];

    const res = await fetch(
      `${GATEWAY}/api/commerce/orders`,
      {
        method:  'POST',
        headers: {
          Authorization:    `Bearer ${getToken(req)}`,
          'Content-Type':   'application/json',
          'x-request-id':  crypto.randomUUID(),
          'x-internal-key': process.env.INTERNAL_SECRET ?? '',
          'x-user-id':      userId,
        },
        body: JSON.stringify({
          items,
          userId,
          payment_id: paymentId,
          memo:       memo ?? (productId ? `Order for product ${productId}` : `Cart order — ${items.length} item(s)`),
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
