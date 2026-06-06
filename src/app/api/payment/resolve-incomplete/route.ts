import { NextRequest, NextResponse } from 'next/server';

const GW = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pid = req.nextUrl.searchParams.get('pi_payment_id')
           ?? (await req.json().catch(() => ({}))).pi_payment_id;

  if (!pid) {
    return NextResponse.json({ error: 'pi_payment_id required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${GW}/api/payment/resolve-incomplete?pi_payment_id=${encodeURIComponent(pid)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':   'application/json',
          Authorization:    `Bearer ${token}`,
          'x-internal-key': process.env.INTERNAL_SECRET ?? '',
          'x-request-id':   crypto.randomUUID(),
        },
        body: JSON.stringify({ pi_payment_id: pid }),
      },
    );

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Resolve failed' }, { status: 500 });
  }
}
