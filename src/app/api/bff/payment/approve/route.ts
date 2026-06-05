import { NextRequest, NextResponse } from 'next/server';

const GW = process.env.API_GATEWAY_URL
        ?? process.env.API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRaw = req.cookies.get('tec_user')?.value;
  const user    = userRaw ? JSON.parse(decodeURIComponent(userRaw)) : null;
  const userId  = user?.id ?? user?.piId ?? null;

  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${GW}/api/payment/approve`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      Authorization:     `Bearer ${token}`,
      'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ ...body, ...(userId ? { userId } : {}) }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('[bff/payment/approve] error:', res.status, JSON.stringify(data));
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(data, { status: res.status });
}
