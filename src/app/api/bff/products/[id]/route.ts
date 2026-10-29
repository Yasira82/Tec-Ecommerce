import { NextRequest, NextResponse } from 'next/server';
import { verifiedMerchants, zoneVerifyUrl } from '@/lib/server/zone-merchants';

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
    const res = await fetch(`${GATEWAY}/api/commerce/products/${id}`, {
      headers: {
        Authorization:    `Bearer ${getToken(req)}`,
        'x-request-id':  crypto.randomUUID(),
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    // The seller's Zone verdict beside the product, wherever the product sits in the answer.
    const product = (data?.data?.product ?? data?.data ?? data?.product ?? null) as Record<string, unknown> | null;
    const sellerId = typeof product?.seller_id === 'string' ? product.seller_id : '';
    if (product && sellerId) {
      const m = (await verifiedMerchants([sellerId]))[sellerId];
      product.seller_verified = m ? { name: m.name, url: zoneVerifyUrl(m.handle) } : null;
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
