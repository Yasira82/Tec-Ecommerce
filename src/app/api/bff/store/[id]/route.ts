import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

const getToken = (req: NextRequest) =>
  req.cookies.get('tec_access_token')?.value ?? '';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!GATEWAY) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  try {
    const { id } = await params;

    const [merchantRes, productsRes] = await Promise.all([
      fetch(`${GATEWAY}/api/commerce/merchants/${id}`, {
        headers: {
          Authorization:    `Bearer ${getToken(req)}`,
          'x-request-id':  crypto.randomUUID(),
          'x-internal-key': process.env.INTERNAL_SECRET ?? '',
        },
        cache: 'no-store',
      }),
      fetch(`${GATEWAY}/api/commerce/products/public?merchant_id=${id}&limit=20`, {
        headers: {
          Authorization:    `Bearer ${getToken(req)}`,
          'x-request-id':  crypto.randomUUID(),
          'x-internal-key': process.env.INTERNAL_SECRET ?? '',
        },
        cache: 'no-store',
      }),
    ]);

    const merchant = merchantRes.ok ? await merchantRes.json() : null;
    const products = productsRes.ok ? await productsRes.json() : { products: [] };

    return NextResponse.json({
      merchant: merchant?.merchant ?? merchant,
      products: products?.data?.products ?? products?.products ?? [],
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch store' }, { status: 500 });
  }
}
