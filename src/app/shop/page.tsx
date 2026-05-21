'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPaymentRecord, createU2APayment } from '@/lib/pi-payment';

interface Product {
  id:          string;
  title:       string;
  name?:       string;
  description: string;
  price:       number;
  images?:     string[];
  image_url?:  string;
  currency?:   string;
}

type PayStatus = 'idle' | 'creating' | 'paying' | 'success' | 'cancelled' | 'error';

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL ?? 'https://hub.tecosystem.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ecommerce.tecosystem.app';
const SSO_URL = `${HUB_URL}/api/auth/sso?target=${encodeURIComponent(APP_URL + '/shop')}`;

const getToken = (): string | null =>
  typeof document === 'undefined' ? null :
  document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1] ?? null;

const getCsrfToken = (): string =>
  typeof document === 'undefined' ? '' :
  document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';

export default function ShopPage() {
  const [authed,     setAuthed]     = useState<boolean | null>(null);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [piReady,    setPiReady]    = useState(false);
  const [payStatus,  setPayStatus]  = useState<PayStatus>('idle');
  const [payMessage, setPayMessage] = useState('');
  const [activeProd, setActiveProd] = useState<Product | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { window.location.href = SSO_URL; return; }
    setAuthed(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as Window & { __TEC_PI_READY?: boolean }).__TEC_PI_READY) {
      setPiReady(true); return;
    }
    const handler = () => setPiReady(true);
    window.addEventListener('tec-pi-ready', handler, { once: true });
    return () => window.removeEventListener('tec-pi-ready', handler);
  }, []);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const res  = await fetch('/api/bff/products', { credentials: 'include' });
        if (res.status === 401) { window.location.href = SSO_URL; return; }
        const data = await res.json();
        const list = data?.data?.products ?? data?.products ?? [];
        setProducts(Array.isArray(list) ? list : []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [authed]);

  const handleBuy = useCallback(async (product: Product) => {
    if (!window.Pi) { alert('Open in Pi Browser'); return; }
    if (!piReady)   { alert('Pi SDK connecting...'); return; }
    if (inFlight.current) return;

    inFlight.current = true;
    setActiveProd(product);
    setPayStatus('creating');
    setPayMessage('');

    try {
      const label      = product.title ?? product.name ?? 'Product';
      const memo       = `${label} — TEC Ecommerce`;
      const internalId = await createPaymentRecord(product.price, product.id, memo);

      if (!internalId) {
        setPayStatus('error');
        setPayMessage('Failed to initialize payment. Please try again.');
        inFlight.current = false;
        return;
      }

      setPayStatus('paying');

      const payResult = await createU2APayment(
        product.price, memo,
        { source: 'ecommerce', product_id: product.id },
        internalId,
      );

      if (payResult.success) {
        try {
          await fetch('/api/bff/orders', {
            method:      'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
            body: JSON.stringify({ product_id: product.id, payment_id: internalId }),
          });
        } catch {}
        setPayStatus('success');
      } else {
        setPayStatus(payResult.status === 'cancelled' ? 'cancelled' : 'error');
        setPayMessage(payResult.message ?? '');
      }
    } catch (err) {
      setPayStatus('error');
      setPayMessage(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      inFlight.current = false;
    }
  }, [piReady]);

  const closeModal = () => {
    setPayStatus('idle');
    setActiveProd(null);
    setPayMessage('');
    inFlight.current = false;
  };

  if (authed === null || (authed && loading)) return (
    <>
      <style>{CSS}</style>
      <div className="loader-wrap">
        <div className="loader-ring" />
        <p className="loader-text">
          {authed === null ? 'Authenticating...' : 'Loading products...'}
        </p>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>

      <div className="page">
        {/* ── Header ── */}
        <header className="header">
          <div className="header-inner">
            <div className="logo">
              <span className="logo-mark">T</span>
              <span className="logo-text">TEC Store</span>
            </div>
            <div className="header-right">
              {!piReady && <span className="sdk-badge">Connecting Pi...</span>}
              {piReady  && <span className="sdk-badge sdk-ready">Pi Ready ✓</span>}
            </div>
          </div>
        </header>

        {/* ── Hero ── */}
        <section className="hero">
          <div className="hero-glow" />
          <h1 className="hero-title">Digital Marketplace</h1>
          <p className="hero-sub">Pay instantly with Pi Network</p>
        </section>

        {/* ── Products ── */}
        <main className="products-wrap">
          {products.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📦</div>
              <p className="empty-text">No products yet</p>
            </div>
          ) : (
            <div className="grid">
              {products.map((product, i) => {
                const imgSrc = product.images?.[0] ?? product.image_url;
                const label  = product.title ?? product.name ?? 'Product';
                return (
                  <article
                    key={product.id}
                    className="card"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="card-img-wrap">
                      {imgSrc
                        ? <img src={imgSrc} alt={label} className="card-img" />
                        : <div className="card-img-placeholder">
                            <span className="placeholder-icon">🛍</span>
                          </div>
                      }
                      <div className="card-price-badge">{product.price}π</div>
                    </div>
                    <div className="card-body">
                      <h2 className="card-title">{label}</h2>
                      <p className="card-desc">{product.description}</p>
                      <button
                        className={`buy-btn ${!piReady ? 'buy-btn--disabled' : ''}`}
                        onClick={() => handleBuy(product)}
                        disabled={!piReady}
                      >
                        {piReady ? 'Buy Now' : 'Connecting...'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ── Payment Modal ── */}
      {payStatus !== 'idle' && activeProd && (
        <div className="modal-backdrop" onClick={payStatus === 'success' || payStatus === 'cancelled' || payStatus === 'error' ? closeModal : undefined}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">T</div>
            <p className="modal-product">{activeProd.title ?? activeProd.name}</p>
            <div className="modal-price">{activeProd.price}π</div>

            {(payStatus === 'creating' || payStatus === 'paying') && (
              <div className="modal-loading">
                <div className="loader-ring" />
                <p className="modal-status-text">
                  {payStatus === 'creating' ? 'Preparing payment...' : 'Confirm in Pi Wallet...'}
                </p>
              </div>
            )}

            {payStatus === 'success' && (
              <div className="modal-result">
                <div className="result-emoji">✅</div>
                <p className="result-title success-text">Payment Successful!</p>
                <button className="btn-primary" onClick={closeModal}>Done</button>
              </div>
            )}

            {payStatus === 'cancelled' && (
              <div className="modal-result">
                <div className="result-emoji">⚠️</div>
                <p className="result-title warn-text">Cancelled</p>
                <div className="btn-row">
                  <button className="btn-primary" onClick={() => { closeModal(); setTimeout(() => handleBuy(activeProd), 100); }}>Try Again</button>
                  <button className="btn-secondary" onClick={closeModal}>Close</button>
                </div>
              </div>
            )}

            {payStatus === 'error' && (
              <div className="modal-result">
                <div className="result-emoji">❌</div>
                <p className="result-title error-text">Payment Failed</p>
                {payMessage && <p className="result-sub">{payMessage}</p>}
                <div className="btn-row">
                  <button className="btn-primary" onClick={() => { closeModal(); setTimeout(() => handleBuy(activeProd), 100); }}>Try Again</button>
                  <button className="btn-secondary" onClick={closeModal}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body, html { background: #07070f; }

  .page {
    min-height: 100vh;
    background: #07070f;
    color: #fff;
    font-family: 'Georgia', 'Times New Roman', serif;
  }

  /* ── Header ── */
  .header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(7,7,15,0.85);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(212,175,55,0.12);
  }
  .header-inner {
    max-width: 800px;
    margin: 0 auto;
    padding: 14px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-mark {
    width: 32px; height: 32px; border-radius: 10px;
    background: linear-gradient(135deg, #d4af37, #8b6914);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 900; color: #07070f;
  }
  .logo-text { font-size: 16px; font-weight: 700; letter-spacing: 0.04em; color: #e8d5a3; }

  .sdk-badge {
    font-family: system-ui, sans-serif;
    font-size: 11px; padding: 4px 10px; border-radius: 20px;
    background: rgba(255,255,255,0.06); color: #666; border: 1px solid rgba(255,255,255,0.08);
  }
  .sdk-ready { background: rgba(126,231,192,0.1); color: #7ee7c0; border-color: rgba(126,231,192,0.2); }

  /* ── Hero ── */
  .hero {
    position: relative;
    text-align: center;
    padding: 48px 20px 40px;
    overflow: hidden;
  }
  .hero-glow {
    position: absolute;
    top: -60px; left: 50%; transform: translateX(-50%);
    width: 400px; height: 200px;
    background: radial-gradient(ellipse, rgba(212,175,55,0.15) 0%, transparent 70%);
    pointer-events: none;
  }
  .hero-title {
    font-size: clamp(28px, 6vw, 42px);
    font-weight: 900;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, #d4af37 0%, #e8d5a3 50%, #b8882a 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 10px;
  }
  .hero-sub {
    font-family: system-ui, sans-serif;
    font-size: 14px; color: #4a4a5a; letter-spacing: 0.08em; text-transform: uppercase;
  }

  /* ── Products ── */
  .products-wrap { max-width: 800px; margin: 0 auto; padding: 8px 16px 48px; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
  }

  /* ── Card ── */
  .card {
    border-radius: 20px;
    background: #0d0d18;
    border: 1px solid rgba(212,175,55,0.12);
    overflow: hidden;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    animation: fadeUp 0.4s ease both;
  }
  .card:hover {
    transform: translateY(-4px);
    border-color: rgba(212,175,55,0.35);
    box-shadow: 0 12px 40px rgba(212,175,55,0.08);
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .card-img-wrap { position: relative; }
  .card-img { width: 100%; height: 150px; object-fit: cover; display: block; }

  .card-img-placeholder {
    width: 100%; height: 150px;
    background: linear-gradient(135deg, #0d0d18, #141420);
    display: flex; align-items: center; justify-content: center;
  }
  .placeholder-icon { font-size: 36px; opacity: 0.4; }

  .card-price-badge {
    position: absolute; top: 10px; right: 10px;
    background: rgba(7,7,15,0.85);
    border: 1px solid rgba(212,175,55,0.4);
    color: #d4af37;
    font-size: 13px; font-weight: 900;
    padding: 4px 10px; border-radius: 20px;
    backdrop-filter: blur(8px);
    font-family: Georgia, serif;
  }

  .card-body { padding: 14px; }
  .card-title { font-size: 14px; font-weight: 700; margin-bottom: 6px; color: #e8d5a3; line-height: 1.3; }
  .card-desc  { font-family: system-ui, sans-serif; font-size: 11px; color: #4a4a5a; line-height: 1.5; margin-bottom: 14px; }

  .buy-btn {
    width: 100%;
    padding: 10px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #d4af37, #b8882a);
    color: #07070f;
    font-size: 13px;
    font-weight: 800;
    font-family: system-ui, sans-serif;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: opacity 0.15s, transform 0.15s;
  }
  .buy-btn:hover:not(.buy-btn--disabled) { opacity: 0.9; transform: scale(0.98); }
  .buy-btn--disabled { background: #1e1e2a; color: #3a3a4a; cursor: not-allowed; }

  /* ── Empty ── */
  .empty { text-align: center; padding: 80px 0; }
  .empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.4; }
  .empty-text { font-family: system-ui, sans-serif; font-size: 14px; color: #3a3a4a; }

  /* ── Loader ── */
  .loader-wrap {
    min-height: 100vh;
    background: #07070f;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 14px;
  }
  .loader-ring {
    width: 36px; height: 36px; border-radius: 50%;
    border: 3px solid rgba(212,175,55,0.15);
    border-top-color: #d4af37;
    animation: spin 0.8s linear infinite;
  }
  .loader-text { font-family: system-ui, sans-serif; font-size: 12px; color: #3a3a4a; letter-spacing: 0.05em; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Modal ── */
  .modal-backdrop {
    position: fixed; inset: 0; z-index: 999;
    background: rgba(0,0,0,0.88);
    backdrop-filter: blur(16px);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .modal {
    width: 100%; max-width: 320px;
    border-radius: 28px;
    background: #0d0d18;
    border: 1px solid rgba(212,175,55,0.2);
    padding: 36px 28px;
    text-align: center;
    box-shadow: 0 40px 80px rgba(0,0,0,0.6);
    animation: slideUp 0.25s ease;
  }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }

  .modal-icon {
    width: 56px; height: 56px; border-radius: 18px;
    background: linear-gradient(135deg, #d4af37, #8b6914);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 900; color: #07070f;
    margin: 0 auto 14px;
    box-shadow: 0 8px 24px rgba(212,175,55,0.25);
  }
  .modal-product { font-family: system-ui, sans-serif; font-size: 12px; color: #4a4a5a; margin-bottom: 6px; letter-spacing: 0.04em; text-transform: uppercase; }
  .modal-price { font-size: 44px; font-weight: 900; color: #d4af37; margin-bottom: 28px; letter-spacing: -0.02em; }

  .modal-loading { display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .modal-status-text { font-family: system-ui, sans-serif; font-size: 13px; color: #4a4a5a; }

  .modal-result { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .result-emoji { font-size: 44px; }
  .result-title { font-family: system-ui, sans-serif; font-size: 16px; font-weight: 700; }
  .result-sub   { font-family: system-ui, sans-serif; font-size: 11px; color: #4a4a5a; max-width: 220px; }

  .success-text { color: #7ee7c0; }
  .warn-text    { color: #f0c040; }
  .error-text   { color: #e74c3c; }

  .btn-row { display: flex; gap: 8px; margin-top: 6px; }

  .btn-primary {
    padding: 12px 28px; border-radius: 14px; border: none;
    background: linear-gradient(135deg, #d4af37, #b8882a);
    color: #07070f; font-size: 13px; font-weight: 800;
    font-family: system-ui, sans-serif;
    cursor: pointer; transition: opacity 0.15s;
  }
  .btn-primary:hover { opacity: 0.88; }

  .btn-secondary {
    padding: 12px 20px; border-radius: 14px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: #888; font-size: 13px;
    font-family: system-ui, sans-serif;
    cursor: pointer; transition: background 0.15s;
  }
  .btn-secondary:hover { background: rgba(255,255,255,0.1); }
`;
