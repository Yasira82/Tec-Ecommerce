import { NextRequest, NextResponse } from 'next/server';
import { releaseHold } from '@/lib/order-hold';

// PATCH /api/bff/orders/:id/cancel — the buyer backed out of paying (Pi's own
// Cancel), so the held units go back on sale now rather than after the TTL.
// commerce-service checks the order is this buyer's and still PENDING: a PAID
// order cannot be cancelled from here.

const GW = process.env.API_GATEWAY_URL ?? '';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!GW) return NextResponse.json({ error: 'Gateway not configured' }, { status: 503 });
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });

  const ok = await releaseHold(id, GW, {
    Authorization: `Bearer ${token}`,
    ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
  }, 'Buyer cancelled the payment');
  return NextResponse.json({ success: ok }, { status: ok ? 200 : 409 });
}
