'use client';
import { useEffect, useState } from 'react';

interface Me { username: string | null; authenticated: boolean; loading: boolean }

// Resolve the real Pi login username via the server (/api/auth/me). Pi Browser
// hides the tec_user cookie from client JS (C-123 §3), so reading it client-side
// (getStoredUser) returns null in Pi Browser — the BFF reads the HttpOnly cookie
// server-side. Fails closed (P6).
export function useMe(): Me {
  const [me, setMe] = useState<Me>({ username: null, authenticated: false, loading: true });
  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const u = (d?.user ?? null) as Record<string, unknown> | null;
        const raw = u?.piUsername ?? u?.username ?? null;
        setMe({
          username: typeof raw === 'string' && raw ? raw : null,
          authenticated: d?.authenticated === true,
          loading: false,
        });
      })
      .catch(() => { if (alive) setMe((p) => ({ ...p, loading: false })); });
    return () => { alive = false; };
  }, []);
  return me;
}
