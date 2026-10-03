import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

const OrderSchema = z.object({
  items:      z.array(z.object({ productId: z.string(), qty: z.coerce.number().int().positive() })).optional(),
  product_id: z.string().optional(),
  payment_id: z.string().min(1),
  memo:       z.string().optional(),
  // The hold the payment was made for (set by /api/bff/payment/create). With it
  // the order already exists: this call CONFIRMS it, it does not create one.
  order_id:   z.string().uuid().optional(),
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
          ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
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

  // CSRF enforced once in middleware (double-submit OR first-party Origin) —
  // single source of truth (P2). A duplicate strict double-submit check here
  // 403'd order creation in Pi Browser (sameSite=None cookie dropped), so a
  // successful payment would fail to create its order.
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rawBody = await req.json().catch(() => ({}));
    const parsed  = OrderSchema.safeParse(rawBody);
    if (!parsed.success) {
      // A 400 here means a COMPLETED PAYMENT produced no order — log exactly
      // why so the failure is diagnosable from runtime logs (C-96: no silent
      // financial-flow failures), without exposing anything to the client.
      console.warn('[bff/orders] VALIDATION_ERROR after payment', {
        issues:   parsed.error.flatten().fieldErrors,
        gotKeys:  Object.keys(rawBody as Record<string, unknown>),
      });
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
    }

    const { product_id, payment_id, memo, items: bodyItems, order_id } = parsed.data;

    if (order_id) return confirmHeld(req, order_id, payment_id, userId);

    if (!product_id && !bodyItems?.length) {
      console.warn('[bff/orders] missing product_id/items after payment', { payment_id });
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
          ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
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

/**
 * The buyer paid for a held order → ask commerce to mark it PAID. Commerce asks
 * payment-service first (completed · this buyer · this order · the full amount),
 * so nothing here is taken on the client's word. "Not confirmed yet" (503) is
 * not a failure: the payment's own event settles the order — answered 202.
 */
async function confirmHeld(req: NextRequest, orderId: string, paymentId: string, userId: string) {
  const pending = () =>
    NextResponse.json({ success: true, data: { pending: true, order_id: orderId } }, { status: 202 });
  let res: Response;
  try {
    res = await fetch(`${GATEWAY}/api/commerce/orders/${encodeURIComponent(orderId)}/confirm`, {
      method:  'POST',
      headers: {
        Authorization:   `Bearer ${getToken(req)}`,
        'Content-Type':  'application/json',
        'x-request-id':  crypto.randomUUID(),
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
        'x-user-id':     userId,
      },
      body: JSON.stringify({ payment_id: paymentId }),
    });
  } catch {
    return pending();
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 503) return pending();
  if (!res.ok) {
    // A paid order that could not be confirmed — say why in the logs (C-96).
    console.error('[bff/orders] confirm failed after payment', { orderId, paymentId, status: res.status, body: JSON.stringify(data) });
  }
  return NextResponse.json(data, { status: res.status });
}
