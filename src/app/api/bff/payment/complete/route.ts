import { NextRequest, NextResponse } from 'next/server';

const GW = process.env.NEXT_PUBLIC_API_GATEWAY_URL
        ?? 'https://api-gateway-production-6a68.up.railway.app';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${GW}/api/payment/complete`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      Authorization:     `Bearer ${token}`,
      'Idempotency-Key': crypto.randomUUID(), // ✅
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
