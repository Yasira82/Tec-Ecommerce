'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StoreIndexPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/shop'); }, [router]);
  return (
    <div style={{ minHeight: '100vh', background: '#050816', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(251,191,36,0.15)', borderTopColor: '#FBBF24', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
