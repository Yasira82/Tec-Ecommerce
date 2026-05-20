import { NextRequest, NextResponse } from 'next/server';

const GW = process.env.NEXT_PUBLIC_API_GATEWAY_URL
        ?? 'https://api-gateway-production-6a68.up.railway.app';

const refreshToken = async (req: NextRequest): Promise<string | null> => {
  try {
    const refresh = req.cookies.get('tec_refresh_token')?.value;
    if (!refresh) return null;
    const res = await fetch(`${GW}/api/auth/refresh`, {
      method:  'POST',
      headers: { Cookie: `tec_refresh_token=${refresh}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.token ?? data?.token ?? null;
  } catch { return null; }
};

export async function POST(req: NextRequest) {
  let token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const call = (t: string) => fetch(`${GW}/api/payment/resolve-incomplete`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      Authorization:     `Bearer ${t}`,
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });

  let res = await call(token);

  // ✅ token انتهت → refresh وحاول تاني
  if (res.status === 401) {
    const newToken = await refreshToken(req);
    if (newToken) {
      res = await call(newToken);
    }
  }

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
