import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const GW = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';

const CreateSchema = z.object({
  amount:   z.number().positive(),
  memo:     z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const getUserId = (req: NextRequest): string => {
  try {
    const raw = req.cookies.get('tec_user')?.value ?? '';
    const u   = JSON.parse(decodeURIComponent(raw));
    return u?.id ?? u?.sub ?? u?.piId ?? '';
  } catch { return ''; }
};

export async function POST(req: NextRequest) {
  if (!GW) return NextResponse.json({ error: 'Gateway not configured' }, { status: 503 });

  const csrfCookie = req.cookies.get('tec_csrf')?.value ?? '';
  const csrfHeader = req.headers.get('x-csrf-token') ?? '';
  if (csrfCookie && csrfCookie !== csrfHeader) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = getUserId(req);
  if (!userId) {
    console.error('[bff/payment/create] missing userId from tec_user cookie');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawBody = await req.json().catch(() => ({}));
  const parsed  = CreateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }

  const { amount, metadata } = parsed.data;

  try {
    const res = await fetch(`${GW}/api/payment/create`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        Authorization:     `Bearer ${token}`,
        'Idempotency-Key': crypto.randomUUID(),
        'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
      },
      body: JSON.stringify({
        userId,
        amount:         Number(amount),
        currency:       'PI',
        payment_method: 'pi',
        metadata:       { ...metadata, source: 'ecommerce' },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[bff/payment/create] gateway error:', res.status, JSON.stringify(data));
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[bff/payment/create] network error:', (err as Error).message);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
