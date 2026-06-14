import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

const OrderSchema = z.object({
  items:      z.array(z.object({ productId: z.string(), qty: z.number().int().positive() })).optional(),
  product_id: z.string().optional(),
  payment_id: z.string().min(1),
  memo:       z.string().optional(),
});

const getToken = (req: NextRequest) =>
  req.cookies.get('tec_access_token')?.value ?? '';

const getUserId = (req: NextRequest): string => {
  try {
    const raw  = req.cookies.get('tec_user')?.value ?? '';
    const user = JSON.parse(decodeURIComponent(raw));
    return user?.id ?? user?.sub ?? user?.uid ?? user?.userId ?? user?.piUid ?? '';
  } catch { return ''; }
};

export async function GET(req: NextRequest) {
  if (!GATEWAY) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const res = await fetch(
      `${GATEWAY}/api/commerce/orders?limit=20&sort=desc`,
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
  if (!GATEWAY) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const csrfCookie = req.cookies.get('tec_csrf')?.value ?? '';
  const csrfHeader = req.headers.get('x-csrf-token') ?? '';
  // Only enforce CSRF when cookie is present — absent cookie means it isn't bridged
  // from Hub SSO to this domain yet (cross-domain SSO); Bearer token protects the route.
  if (csrfCookie && csrfCookie !== csrfHeader) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rawBody = await req.json().catch(() => ({}));
    const parsed  = OrderSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
    }

    const { product_id, payment_id, memo, items: bodyItems } = parsed.data;

    if (!product_id && !bodyItems?.length) {
      return NextResponse.json(
        { error: 'payment_id and either product_id or items[] required' },
        { status: 400 },
      );
    }

    const items = bodyItems ?? [{ productId: product_id!, qty: 1 }];

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
          payment_id,
          memo: memo ?? (product_id ? `Order for product ${product_id}` : `Cart order — ${items.length} item(s)`),
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
