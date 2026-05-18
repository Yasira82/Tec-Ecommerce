import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL
  ?? 'https://api-gateway-production-6a68.up.railway.app';

const getToken = (req: NextRequest) =>
  req.cookies.get('tec_access_token')?.value ?? '';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const params = new URLSearchParams();
    const category = searchParams.get('category');
    const limit    = searchParams.get('limit') ?? '12';
    const page     = parseInt(searchParams.get('page') ?? '1');
    const offset   = (page - 1) * parseInt(limit);

    if (category && category !== 'all') params.set('category', category);
    params.set('limit',  limit);
    params.set('offset', String(offset));

    const res = await fetch(
      `${GATEWAY}/api/commerce/products?${params}`,
      {
        headers: {
          Authorization:    `Bearer ${getToken(req)}`,
          'x-request-id':  crypto.randomUUID(),
          'x-internal-key': process.env.INTERNAL_SECRET ?? '',
        },
        cache: 'no-store',
      },
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
