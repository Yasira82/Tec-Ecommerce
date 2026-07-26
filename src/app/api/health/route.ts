import { NextResponse } from 'next/server';

// Uniform platform health signal (C-92/C-96). Fail-safe + public: it never
// throws and never 500s — an unconfigured or unreachable gateway is reported as
// `online: false`, not an error page. Mirrors the other TEC apps' /api/health.
export async function GET() {
  const gatewayUrl = process.env.API_GATEWAY_URL;

  if (!gatewayUrl) {
    return NextResponse.json({ online: false, error: 'not configured' });
  }

  try {
    const res = await fetch(`${gatewayUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ online: false, error: `status ${res.status}` });
    }

    const data = await res.json();
    return NextResponse.json({ online: true, ...data });
  } catch (err) {
    return NextResponse.json({
      online: false,
      error:  err instanceof Error ? err.message : 'Failed to reach gateway',
    });
  }
}
