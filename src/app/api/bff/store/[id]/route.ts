import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL ?? '';

const getToken = (req: NextRequest) =>
  req.cookies.get('tec_access_token')?.value ?? '';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ProductRow { seller_id?: unknown }

// A store is a seller's ACTIVE products. This route used to ask commerce for
// `/merchants/:id` and `/products/public` — neither exists, so every store page
// read "Merchant not found · Products (0)" (seen 3 Oct 2026). commerce has no
// merchant profile; the store is built from the seller's own listings, and the
// name stays the label the product card shows.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!GATEWAY) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ merchant: null, products: [] });

  try {
    const res = await fetch(`${GATEWAY}/api/commerce/products?seller=${encodeURIComponent(id)}&limit=100`, {
      headers: {
        Authorization:   `Bearer ${getToken(req)}`,
        'x-request-id':  crypto.randomUUID(),
        ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
      },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch store' }, { status: 502 });
    const body = await res.json().catch(() => null) as { data?: { products?: unknown } } | null;
    const all  = Array.isArray(body?.data?.products) ? body!.data!.products as ProductRow[] : [];
    // Filtered here as well: a commerce that predates `?seller=` returns every
    // seller's products, and a store must never show another seller's goods.
    const products = all.filter((p) => p?.seller_id === id).map((row) => {
      const p    = row as Record<string, unknown>;
      const meta = (p.metadata ?? {}) as Record<string, unknown>;
      // Same shape as /api/bff/products, so the cards and the cart read it alike.
      return {
        ...p,
        price:  Number(p.price),
        images: (meta.images as string[] | undefined) ?? (p.image_url ? [p.image_url] : []),
      };
    });

    return NextResponse.json({
      merchant: products.length ? { id, display_name: 'TEC Store', products_count: products.length } : null,
      products,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch store' }, { status: 500 });
  }
}
