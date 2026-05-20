import { NextRequest, NextResponse } from 'next/server';

const GW = process.env.NEXT_PUBLIC_API_GATEWAY_URL
        ?? 'https://api-gateway-production-6a68.up.railway.app';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { amount, currency, payment_method, metadata } = body;

  const res = await fetch(`${GW}/api/payment/create`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      Authorization:     `Bearer ${token}`,
      'Idempotency-Key': crypto.randomUUID(), // ✅ مطلوب
    },
    body: JSON.stringify({
      amount,
      currency:       currency       ?? 'PI',
      payment_method: payment_method ?? 'pi',
      metadata:       { ...metadata, source: 'ecommerce' },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('[bff/payment/create] gateway error:', res.status, data);
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(data, { status: res.status });
}
