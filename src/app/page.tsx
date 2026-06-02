'use client';

import { useEffect } from 'react';
import { usePiAuth, ssoRedirect } from '@yasser172/tec-auth';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = usePiAuth();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      window.location.href = '/shop';
      return;
    }
    ssoRedirect(HUB_URL, `${APP_URL}/shop`);
  }, [isAuthenticated, isLoading]);

  return (
    <div style={{
      minHeight: '100vh', background: '#07070f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid rgba(212,175,55,0.15)',
          borderTopColor: '#d4af37',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ fontSize: 12, color: '#4a4a5a' }}>Connecting to TEC...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
