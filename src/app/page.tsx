'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';

export default function HomePage() {
  const { isAuthenticated, isLoading, login } = usePiAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/app');
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <div style={{ minHeight: '100vh', background: '#020205', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔷</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#d4af37', marginBottom: 8 }}>TEC</div>
        <div style={{ fontSize: 13, color: '#4a4a5a', marginBottom: 32 }}>SUPER APP</div>
        <button
          onClick={login}
          style={{ padding: '14px 32px', background: 'linear-gradient(135deg,#d4af37,#b8882a)', border: 'none', borderRadius: 16, color: '#0a0800', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Login with Pi
        </button>
      </div>
    </div>
  );
}
