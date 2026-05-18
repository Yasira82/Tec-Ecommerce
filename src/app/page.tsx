'use client';

import { useEffect }              from 'react';
import { useRouter }              from 'next/navigation';
import { usePiAuth, ssoRedirect } from '@yasser172/tec-auth';
import { TEC_COLORS }             from '@yasser172/tec-ui';

const HUB_URL      = process.env.NEXT_PUBLIC_HUB_URL  ?? 'https://hub.tecosystem.app';
const ECOMMERCE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';

export default function HomePage() {
  const { isAuthenticated, isLoading } = usePiAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/shop');
  }, [isLoading, isAuthenticated, router]);

  const handleLogin = () => ssoRedirect(HUB_URL, `${ECOMMERCE_URL}/shop`);

  return (
    <div style={{ minHeight: '100vh', background: '#020205', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }`}</style>
      <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🛍️</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: TEC_COLORS.gold, marginBottom: 6 }}>TEC Store</div>
        <div style={{ fontSize: 13, color: TEC_COLORS.subtext, marginBottom: 8 }}>ECOMMERCE · TEC ECOSYSTEM</div>
        <div style={{ fontSize: 12, color: '#2a2a3a', marginBottom: 36 }}>Shop with Pi — One Identity, One Wallet</div>
        <button onClick={handleLogin} disabled={isLoading}
          style={{ padding: '14px 36px', background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`, border: 'none', borderRadius: 16, color: '#0a0800', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
          {isLoading ? '...' : '🔷 Login with Pi'}
        </button>
      </div>
    </div>
  );
}
