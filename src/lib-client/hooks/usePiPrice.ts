'use client';
import { useEffect, useState } from 'react';

// Live Pi/USD market rate (via our cached /api/pi-price). Returns null until
// loaded, and stays null on failure — callers hide the "≈ $" estimate when null
// so the UI never shows a wrong/zero dollar figure (fail safe).
export function usePiPrice(): number | null {
  const [usd, setUsd] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/pi-price', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const v = d?.usd;
        setUsd(typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
      })
      .catch(() => { /* keep null → estimate hidden */ });
    return () => { alive = false; };
  }, []);
  return usd;
}

// Format a π amount as an "≈ $Y" market reference, or '' when no rate is known.
export function formatUsd(pi: number, piUsd: number | null): string {
  if (piUsd === null || !Number.isFinite(pi)) return '';
  const v = pi * piUsd;
  if (v <= 0) return '';
  // < $1 → 2 decimals ($0.43); ≥ $1 → up to 2 but drop trailing for round numbers
  return v < 1 ? `$${v.toFixed(2)}` : `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
