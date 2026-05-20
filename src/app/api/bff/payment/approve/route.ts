import { NextRequest, NextResponse } from 'next/server';

const GW = process.env.NEXT_PUBLIC_API_GATEWAY_URL
        ?? 'https://api-gateway-production-6a68.up.railway.app';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRaw = req.cookies.get('tec_user')?.value;
  const user    = userRaw ? JSON.parse(decodeURIComponent(userRaw)) : null;
  const userId  = user?.id ?? user?.piId ?? null;

  const body = await req.json().catch(() => ({}));

  console.log('[bff/payment/approve] request body:', JSON.stringify(body));
  console.log('[bff/payment/approve] userId:', userId);

  const res = await fetch(`${GW}/api/payment/approve`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      Authorization:     `Bearer ${token}`,
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ ...body, ...(userId ? { userId } : {}) }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('[bff/payment/approve] error:', res.status, JSON.stringify(data));
    return NextResponse.json(data, { status: res.status });
  }

  console.log('[bff/payment/approve] success:', JSON.stringify(data));
  return NextResponse.json(data, { status: res.status });
}
