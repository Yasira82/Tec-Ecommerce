import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const GW = process.env.API_GATEWAY_URL;

const CompleteSchema = z.object({
  payment_id:     z.string().min(1),
  transaction_id: z.string().min(1),
});

export async function POST(req: NextRequest) {
  if (!GW) return NextResponse.json({ error: 'Gateway not configured' }, { status: 503 });

  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw    = await req.json().catch(() => ({}));
  const parsed = CompleteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }

  const res = await fetch(`${GW}/api/payment/complete`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      Authorization:     `Bearer ${token}`,
      'Idempotency-Key': crypto.randomUUID(),
      'x-internal-key':  process.env.INTERNAL_SECRET ?? '',
    },
    body: JSON.stringify(parsed.data),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
