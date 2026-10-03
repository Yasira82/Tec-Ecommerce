import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkPurchase, linesFrom } from '@/lib/purchase-guard';
import { placeHold } from '@/lib/order-hold';

// POST /api/bff/orders/hold — reserve the units before the buyer is sent to the
// Hub to pay (Mode 1). The Hub cannot see this app's cart or stock; it only
// carries `order_id` into the payment's metadata, and the payment's event turns
// this hold into a PAID order. Same two steps as payment/create: the price and
// stock check, then the hold that actually takes the units.

const GW = process.env.API_GATEWAY_URL ?? '';

const HoldSchema = z.object({
  amount:     z.coerce.number().positive(),
  product_id: z.string().optional(),
  items:      z.array(z.object({ productId: z.string(), qty: z.coerce.number().int().positive() })).optional(),
});

export async function POST(req: NextRequest) {
  if (!GW) return NextResponse.json({ error: 'Gateway not configured' }, { status: 503 });
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = HoldSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }
  const lines = linesFrom(parsed.data as Record<string, unknown>);
  if (!lines) return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'No product named.' }, { status: 400 });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
  };
  const check = await checkPurchase(lines, parsed.data.amount, GW, headers);
  if (!check.ok) return NextResponse.json({ error: check.error, message: check.message }, { status: check.status });

  const hold = await placeHold(lines, GW, headers);
  if (hold.ok === false) return NextResponse.json({ error: hold.error, message: hold.message }, { status: hold.status });
  if (hold.ok === 'unsupported') return NextResponse.json({ success: true, data: { order_id: null } });
  return NextResponse.json({ success: true, data: { order_id: hold.orderId } }, { status: 201 });
}
