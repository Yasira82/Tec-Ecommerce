import { NextRequest, NextResponse } from 'next/server';

const GW = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { pi_payment_id } = await req.json().catch(() => ({ pi_payment_id: '' }));
  if (!pi_payment_id) return NextResponse.json({ error: 'pi_payment_id required' }, { status: 400 });

  const results: Record<string, unknown> = {};

  // Try cancel
  try {
    const res = await fetch(`${GW}/api/payment/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
      body: JSON.stringify({ pi_payment_id, source: 'ecommerce' }),
    });
    results.cancel = { status: res.status, data: await res.json().catch(() => ({})) };
  } catch (e) { results.cancel = { error: String(e) }; }

  // Try complete with empty txid
  try {
    const res = await fetch(`${GW}/api/payment/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
      body: JSON.stringify({ pi_payment_id, txid: '', source: 'ecommerce' }),
    });
    results.complete = { status: res.status, data: await res.json().catch(() => ({})) };
  } catch (e) { results.complete = { error: String(e) }; }

  return NextResponse.json({ success: true, results });
}
