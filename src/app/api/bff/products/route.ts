import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL;

const getToken = (req: NextRequest) =>
  req.cookies.get('tec_access_token')?.value ?? '';

export async function GET(req: NextRequest) {
  if (!GATEWAY) {
    console.error('[bff/products] API_GATEWAY_URL is not configured');
    return NextResponse.json(
      { error: 'Service not configured', code: 'GATEWAY_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  try {
    const { searchParams } = req.nextUrl;

    const params   = new URLSearchParams();
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
    if (!res.ok) {
      console.error('[bff/products] gateway error:', res.status, JSON.stringify(data));
      return NextResponse.json(data, { status: res.status });
    }

    // ✅ normalize products
    const raw      = (data?.data?.products ?? data?.products ?? []) as Record<string, unknown>[];
    const products = raw.map(p => {
      const meta = (p['metadata'] ?? {}) as Record<string, unknown>;
      return {
        ...p,
        images:        (meta['images'] as string[]) ?? (p['image_url'] ? [p['image_url']] : []),
        rating:        (meta['rating']       as number) ?? 0,
        reviews_count: (meta['reviewCount']  as number) ?? 0,
        seller_id:     (p['seller_id'] as string) ?? '',
        merchant_name: (p['seller_id'] as string) ?? '',
      };
    });

    return NextResponse.json({ success: true, data: { products } });
  } catch (err) {
    console.error('[bff/products] unexpected error:', err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
