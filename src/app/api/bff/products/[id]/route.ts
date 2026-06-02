import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL
             ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL!;

const getToken = (req: NextRequest) =>
  req.cookies.get('tec_access_token')?.value ?? '';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const res = await fetch(`${GATEWAY}/api/commerce/products/${id}`, {
      headers: {
        Authorization:    `Bearer ${getToken(req)}`,
        'x-request-id':  crypto.randomUUID(),
        'x-internal-key': process.env.INTERNAL_SECRET ?? '',
      },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
