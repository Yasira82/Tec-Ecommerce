import { NextRequest, NextResponse } from 'next/server';

const GW = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRaw = req.cookies.get('tec_user')?.value;
  const user    = userRaw ? JSON.parse(decodeURIComponent(userRaw)) : null;
  const userId  = user?.id ?? user?.piId ?? null;

  if (!userId) {
    console.error('[bff/payment/create] missing userId from tec_user cookie');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { amount, currency, payment_method, metadata } = body;

  const res = await fetch(`${GW}/api/payment/create`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      Authorization:     `Bearer ${token}`,
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      userId,
      amount:         Number(amount),
      currency:       currency       ?? 'PI',
      payment_method: payment_method ?? 'pi',
      metadata:       { ...metadata, source: 'ecommerce' },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('[bff/payment/create] gateway error:', res.status, JSON.stringify(data));
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(data, { status: res.status });
}
