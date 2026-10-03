import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { networkMetadata } from '@/lib/pi-network';
import { checkPurchase, linesFrom } from '@/lib/purchase-guard';
import { placeHold, releaseHold } from '@/lib/order-hold';

const GW = process.env.API_GATEWAY_URL ?? '';

const CreateSchema = z.object({
  amount:   z.coerce.number().positive(),
  memo:     z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const getUserId = (req: NextRequest): string => {
  try {
    const raw = req.cookies.get('tec_user')?.value ?? '';
    const u   = JSON.parse(decodeURIComponent(raw));
    return u?.id ?? u?.sub ?? u?.piId ?? '';
  } catch { return ''; }
};

export async function POST(req: NextRequest) {
  if (!GW) return NextResponse.json({ error: 'Gateway not configured' }, { status: 503 });

  // CSRF enforced once in middleware (double-submit OR first-party Origin) —
  // single source of truth (P2). A duplicate strict double-submit check here
  // 403'd legit Mode-2 payments in Pi Browser, where sameSite=None cookies drop.
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawBody = await req.json().catch(() => ({}));
  const parsed  = CreateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }

  // Unlike the template's route, this one accepts free-form client metadata —
  // so a `testnet` key sent by the caller must be REMOVED here, not merely
  // overwritten further down. On the Mainnet host `networkMetadata()` returns
  // an empty object, so an overwrite is no overwrite at all and the client's
  // claim would survive: a buyer could tag a payment Test-Pi and have a
  // consumer grant something real for it. Dropped before the spread, so a
  // later edit that reorders the object cannot hand the network back.
  const { amount, metadata: clientMetadata } = parsed.data;
  // order_id likewise: only this route's own hold may name the order paid for.
  const { testnet: _clientTestnet, order_id: _clientOrderId, ...metadata } = clientMetadata ?? {};

  const gwHeaders: Record<string, string> = {
    'Content-Type':    'application/json',
    Authorization:     `Bearer ${token}`,
    'Idempotency-Key': crypto.randomUUID(),
  };
  if (process.env.INTERNAL_SECRET) gwHeaders['x-internal-key'] = process.env.INTERNAL_SECRET;

  // No payment for something that cannot be delivered (lib/purchase-guard.ts).
  // Every Ecommerce payment is for products — a body that names none is refused.
  const lines = linesFrom(metadata);
  if (!lines) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'No product in this payment.' }, { status: 400 });
  }
  const commerceHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
  };
  const check = await checkPurchase(lines, Number(amount), GW, commerceHeaders);
  if (!check.ok) {
    console.warn('[bff/payment/create] refused before payment:', check.error, JSON.stringify(lines));
    return NextResponse.json({ error: check.error, message: check.message }, { status: check.status });
  }

  // The check above can be true for two buyers at once; the hold cannot — it
  // TAKES the units (lib/order-hold.ts). The payment carries its order_id, so
  // the order is settled from the payment itself, not from a later client call.
  const hold = await placeHold(lines, GW, commerceHeaders);
  if (hold.ok === false) {
    console.warn('[bff/payment/create] hold refused before payment:', hold.error, JSON.stringify(lines));
    return NextResponse.json({ error: hold.error, message: hold.message }, { status: hold.status });
  }
  if (hold.ok === 'unsupported') console.warn('[bff/payment/create] commerce has no holds yet — paying without one');
  const orderId = hold.ok === true ? hold.orderId : undefined;
  // A payment that never started must not keep the units for the whole TTL.
  const giveBack = (why: string) => {
    if (orderId) void releaseHold(orderId, GW, commerceHeaders, why);
  };

  try {
    const res = await fetch(`${GW}/api/payment/create`, {
      method:  'POST',
      headers: gwHeaders,
      body: JSON.stringify({
        userId,
        amount:         Number(amount),
        currency:       'PI',
        payment_method: 'pi',
        // `testnet` is derived from the REQUEST HOST, never sent by the
        // client — a client-set network flag is a client-controlled claim
        // about which Pi network to charge on. It is present only when true,
        // so a Mainnet payment carries no such key at all and its payload is
        // byte-identical to what it has always been.
        // order_id comes only from the hold above (the client's was dropped).
        metadata:       {
          ...metadata, source: 'ecommerce',
          ...(orderId ? { order_id: orderId } : {}),
          ...networkMetadata(req.headers.get('host')),
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[bff/payment/create] gateway error:', res.status, JSON.stringify(data));
      giveBack('Payment could not be created');
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(
      orderId && data && typeof data === 'object' ? { ...data, order_id: orderId } : data,
      { status: res.status },
    );
  } catch (err) {
    console.error('[bff/payment/create] network error:', (err as Error).message);
    giveBack('Payment could not be created');
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
