import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from '@/app/api/health/route';

const origEnv = process.env.API_GATEWAY_URL;

afterEach(() => {
  vi.restoreAllMocks();
  if (origEnv === undefined) delete process.env.API_GATEWAY_URL;
  else process.env.API_GATEWAY_URL = origEnv;
});

describe('GET /api/health', () => {
  it('reports offline (never throws) when the gateway is not configured', async () => {
    delete process.env.API_GATEWAY_URL;
    const res  = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.online).toBe(false);
  });

  it('reports online when the gateway responds ok', async () => {
    process.env.API_GATEWAY_URL = 'https://gw.test.example.com';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ status: 'ok' }),
    } as unknown as Response);
    const res  = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.online).toBe(true);
    expect(body.status).toBe('ok');
  });

  it('reports offline (never throws) when the gateway is unreachable', async () => {
    process.env.API_GATEWAY_URL = 'https://gw.test.example.com';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const res  = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.online).toBe(false);
    expect(body.error).toContain('network down');
  });
});
