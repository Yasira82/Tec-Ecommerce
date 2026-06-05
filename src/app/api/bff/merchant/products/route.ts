import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL
             ?? process.env.API_GATEWAY_URL!;

const getToken = (req: NextRequest) =>
  req.cookies.get('tec_access_token')?.value ?? '';

const getSellerId = (req: NextRequest): string => {
  try {
    const raw  = req.cookies.get('tec_user')?.value ?? '';
    const user = JSON.parse(decodeURIComponent(raw));
    return user?.id ?? user?.sub ?? '';
  } catch { return ''; }
};

export async function GET(req: NextRequest) {
  const sellerId = getSellerId(req);
  if (!sellerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const params = new URLSearchParams({ limit: '100', seller_id: sellerId });

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

    const raw      = (data?.data?.products ?? data?.products ?? []) as Record<string, unknown>[];
    const products = raw.map(p => {
      const meta = (p['metadata'] ?? {}) as Record<string, unknown>;
      return {
        ...p,
        images:        (meta['images'] as string[]) ?? (p['image_url'] ? [p['image_url']] : []),
        rating:        (meta['rating']      as number) ?? 0,
        reviews_count: (meta['reviewCount'] as number) ?? 0,
      };
    });

    return NextResponse.json({ success: true, data: { products } });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch merchant products' }, { status: 500 });
  }
}
