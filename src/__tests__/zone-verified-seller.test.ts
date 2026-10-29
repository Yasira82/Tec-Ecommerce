import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// "Verified merchant" beside a seller is ZONE's verdict, presented here. These pin:
// the badge appears only on Zone's answer, matches the right seller, and any failure on
// the way means no badge — never a guessed one (P6).

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';

let zoneAnswer: { ok: boolean; body?: unknown; throws?: boolean };
let zoneCalls: string[];

beforeEach(() => {
  vi.resetModules();
  process.env.API_GATEWAY_URL = 'https://gw.test';
  process.env.INTERNAL_SECRET = 'x'.repeat(32);
  process.env.E2E_MODE = 'false';
  process.env.CI = 'false';
  zoneCalls = [];
  zoneAnswer = { ok: true, body: { data: { merchants: { [S1]: { handle: 'sara-shop', name: 'Sara Shop' } } } } };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/identity/zone/merchants')) {
      zoneCalls.push(url);
      if (zoneAnswer.throws) throw new Error('timeout');
      return new Response(JSON.stringify(zoneAnswer.body ?? {}), { status: zoneAnswer.ok ? 200 : 503 });
    }
    if (url.includes('/commerce/products?seller=')) {
      return new Response(JSON.stringify({ data: { products: [{ id: 'p1', seller_id: S1, price: '5' }] } }), { status: 200 });
    }
    if (url.includes('/commerce/products')) {
      return new Response(JSON.stringify({ data: { products: [
        { id: 'p1', seller_id: S1, price: 5 }, { id: 'p2', seller_id: S2, price: 7 },
      ] } }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const req = (u: string) => new NextRequest(`https://ecommerce.tecosystem.app${u}`);

describe('product list', () => {
  it('badges only the seller Zone named, with a link to the evidence', async () => {
    const { GET } = await import('@/app/api/bff/products/route');
    const out = await (await GET(req('/api/bff/products'))).json();
    const [p1, p2] = out.data.products;
    expect(p1.seller_verified).toEqual({ name: 'Sara Shop', url: 'https://zone.tecosystem.app/verify/sara-shop' });
    expect(p2.seller_verified).toBeNull();
    expect(zoneCalls).toHaveLength(1);                    // one batched question, not one per card
    expect(zoneCalls[0]).toContain(`ids=${S1},${S2}`);
  });

  it('Zone down → the products still load, with no badge at all', async () => {
    zoneAnswer = { ok: false };
    const { GET } = await import('@/app/api/bff/products/route');
    const out = await (await GET(req('/api/bff/products'))).json();
    expect(out.data.products).toHaveLength(2);
    expect(out.data.products.every((p: { seller_verified: unknown }) => p.seller_verified === null)).toBe(true);
  });

  it('a timeout is the same: no badge, never an error', async () => {
    zoneAnswer = { ok: true, throws: true };
    const { GET } = await import('@/app/api/bff/products/route');
    expect((await GET(req('/api/bff/products'))).status).toBe(200);
  });

  it('an answer naming a seller we did not ask about is ignored', async () => {
    zoneAnswer = { ok: true, body: { data: { merchants: { '99999999-9999-4999-8999-999999999999': { handle: 'x', name: 'X' } } } } };
    const { GET } = await import('@/app/api/bff/products/route');
    const out = await (await GET(req('/api/bff/products'))).json();
    expect(out.data.products.every((p: { seller_verified: unknown }) => p.seller_verified === null)).toBe(true);
  });
});

describe('store page', () => {
  it('a verified store carries the business name Zone checked and the evidence link', async () => {
    const { GET } = await import('@/app/api/bff/store/[id]/route');
    const out = await (await GET(req(`/api/bff/store/${S1}`), { params: Promise.resolve({ id: S1 }) })).json();
    expect(out.merchant).toMatchObject({ display_name: 'Sara Shop', verified: { name: 'Sara Shop' } });
  });

  it('an unverified store keeps the plain label and no badge', async () => {
    zoneAnswer = { ok: true, body: { data: { merchants: {} } } };
    const { GET } = await import('@/app/api/bff/store/[id]/route');
    const out = await (await GET(req(`/api/bff/store/${S1}`), { params: Promise.resolve({ id: S1 }) })).json();
    expect(out.merchant).toMatchObject({ display_name: 'TEC Store', verified: null });
  });
});
