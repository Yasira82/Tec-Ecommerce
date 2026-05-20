import { NextRequest, NextResponse } from 'next/server';

const GW = process.env.NEXT_PUBLIC_API_GATEWAY_URL
        ?? 'https://api-gateway-production-6a68.up.railway.app';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body          = await req.json().catch(() => ({}));
  const pi_payment_id = body?.pi_payment_id as string | undefined;

  if (!pi_payment_id) return NextResponse.json({ error: 'pi_payment_id required' }, { status: 400 });

  // ✅ نفس Hub — في الـ URL + الـ body
  const res = await fetch(
    `${GW}/api/payment/resolve-incomplete?pi_payment_id=${encodeURIComponent(pi_payment_id)}`,
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({ pi_payment_id }),
    },
  );

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
