'use client';

import { useState, useEffect } from 'react';

const APP_VERSION = '1.0.0';
const BUILD       = '2026.05';

interface Props {
  isOpen:    boolean;
  onClose:   () => void;
  username?: string;
  hubUrl:    string;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{ width:44, height:24, borderRadius:12, position:'relative', cursor:'pointer', flexShrink:0, border:'none', background: value ? 'linear-gradient(135deg,#d4af37,#b8882a)' : '#1a1a2a', transition:'all 0.2s' }}>
      <div style={{ position:'absolute', top:3, left: value ? 23 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }} />
    </button>
  );
}

function Row({ icon, label, right, onClick }: { icon: string; label: string; right?: React.ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 20px', borderBottom:'1px solid #ffffff06', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:17, width:24, textAlign:'center' }}>{icon}</span>
        <span style={{ fontSize:13, color:'#d0d0e0', fontWeight:500 }}>{label}</span>
      </div>
      {right && <div>{right}</div>}
      {onClick && !right && <span style={{ fontSize:12, color:'#4a4a5a' }}>→</span>}
    </div>
  );
}

function Section({ label }: { label: string }) {
  return <div style={{ padding:'14px 20px 6px', fontSize:9, color:'#4a4a5a', letterSpacing:2, textTransform:'uppercase', fontWeight:700 }}>{label}</div>;
}

export function EcommerceDrawer({ isOpen, onClose, username, hubUrl }: Props) {
  const [darkMode,     setDarkMode]     = useState(true);
  const [hidePrices,   setHidePrices]   = useState(false);
  const [isOnline,     setIsOnline]     = useState(true);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [piRate,       setPiRate]       = useState<number | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd')
      .then(r => r.json())
      .then(d => { if (d?.['pi-network']?.usd) setPiRate(d['pi-network'].usd); })
      .catch(() => {});
  }, []);

  const handleShare = () => {
    const url = window.location.origin + '/shop';
    if (navigator.share) {
      navigator.share({ title: 'TEC Ecommerce', text: 'Shop on Pi Network', url });
    } else {
      navigator.clipboard.writeText(url).then(() => alert('Link copied!'));
    }
  };

  const handleClearCache = () => {
    try { localStorage.clear(); } catch {}
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2000);
  };

  return (
    <>
      {isOpen && (
        <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:290, background:'rgba(2,2,5,0.8)', backdropFilter:'blur(8px)' }} />
      )}

      <div style={{ position:'fixed', top:0, left:0, bottom:0, zIndex:300, width:280, background:'#0a0a12', borderRight:'1px solid #ffffff0a', transform: isOpen ? 'translateX(0)' : 'translateX(-100%)', transition:'transform 0.3s cubic-bezier(0.16,1,0.3,1)', display:'flex', flexDirection:'column', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid #ffffff0a' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#d4af37,#b8882a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'#07070f' }}>🛍</div>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:'#d4af37' }}>Ecommerce</div>
                <div style={{ fontSize:9, color:'#4a4a5a', letterSpacing:2 }}>TEC ECOSYSTEM</div>
              </div>
            </div>
            <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'#ffffff08', border:'none', color:'#6b6b7a', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          </div>

          {username && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#ffffff05', borderRadius:12 }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#d4af37,#b8882a)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:15, color:'#07070f', flexShrink:0 }}>
                {username[0].toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#fff' }}>@{username}</div>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background: isOnline ? '#10b981' : '#ef4444', display:'inline-block' }} />
                  <span style={{ fontSize:9, color: isOnline ? '#10b981' : '#ef4444' }}>{isOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex:1 }}>

          <Section label="Preferences" />
          <Row icon={darkMode ? '🌙' : '☀️'} label={darkMode ? 'Dark Mode' : 'Light Mode'}
            right={<Toggle value={darkMode} onChange={setDarkMode} />}
          />
          <Row icon="👁️" label="Hide Prices"
            right={<Toggle value={hidePrices} onChange={setHidePrices} />}
          />

          {piRate && (
            <div style={{ margin:'0 20px 4px', padding:'8px 12px', background:'rgba(212,175,55,0.06)', border:'1px solid rgba(212,175,55,0.15)', borderRadius:10 }}>
              <div style={{ fontSize:10, color:'#4a4a5a' }}>Pi rate</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#d4af37' }}>1π ≈ ${piRate.toFixed(4)}</div>
            </div>
          )}

          <Section label="App" />
          <Row icon="🔗" label="Share App"     onClick={handleShare} />
          <Row icon="❓" label="Help & Support" onClick={() => { window.location.href = `${hubUrl}/hub`; }} />
          <Row icon="🔒" label="Privacy Policy" onClick={() => { window.location.href = `${hubUrl}/privacy`; }} />

          <Section label="System" />
          <Row icon={isOnline ? '📶' : '📵'} label="Connection"
            right={<span style={{ fontSize:11, fontWeight:600, color: isOnline ? '#10b981' : '#ef4444' }}>{isOnline ? 'Online' : 'Offline'}</span>}
          />
          <Row icon="🗑️" label="Clear Cache" onClick={handleClearCache}
            right={cacheCleared ? <span style={{ fontSize:11, color:'#10b981', fontWeight:600 }}>✓ Done</span> : undefined}
          />
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 20px', borderTop:'1px solid #ffffff0a' }}>
          <button onClick={() => { window.location.href = `${hubUrl}/hub`; }}
            style={{ width:'100%', padding:11, borderRadius:12, background:'#ffffff08', border:'1px solid #ffffff10', color:'#d4af37', fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:12 }}>
            🔷 Back to Hub
          </button>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#d0d0e0', marginBottom:2 }}>TEC Ecommerce</div>
            <div style={{ fontSize:10, color:'#4a4a5a' }}>v{APP_VERSION} · Build {BUILD}</div>
            <div style={{ fontSize:9, color:'#3a3a4a', marginTop:4 }}>© 2026 TEC Ecosystem · Pi Network</div>
          </div>
        </div>

      </div>
    </>
  );
}
