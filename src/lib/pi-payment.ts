const getCsrfToken = (): string =>
  typeof document === 'undefined' ? '' :
  document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';

const getAccessToken = (): string | null =>
  typeof document === 'undefined' ? null :
  document.cookie.split('; ').find(r => r.startsWith('tec_access_token='))?.split('=')?.[1] ?? null;

const getStoredUser = (): { id?: string } | null => {
  try {
    const raw = typeof document === 'undefined' ? '' :
      document.cookie.split('; ').find(r => r.startsWith('tec_user='))?.split('=')?.[1] ?? '';
    return raw ? JSON.parse(decodeURIComponent(raw)) : null;
  } catch { return null; }
};

const PI_PAYMENT_ID_REGEX = /^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*$/;
const PI_TXID_REGEX       = /^[a-zA-Z0-9_-]{8,128}$/;

export interface PaymentResult {
  success:    boolean;
  paymentId?: string;
  txid?:      string;
  status:     'completed' | 'cancelled' | 'failed' | 'error';
  amount:     number;
  memo:       string;
  message?:   string;
}

const waitForPiSdk = (timeout = 15000): Promise<void> => {
  if (typeof window !== 'undefined' && window.__TEC_PI_READY && window.Pi)
    return Promise.resolve();
  return new Promise(resolve => {
    const done = () => { window.removeEventListener('tec-pi-ready', done); resolve(); };
    window.addEventListener('tec-pi-ready', done, { once: true });
    setTimeout(done, timeout);
  });
};

// ── pre-create payment record in TEC backend ──────────────
export const createPaymentRecord = async (
  amount:    number,
  productId: string,
  memo:      string,
): Promise<string | null> => {
  try {
    const token = getAccessToken();
    if (!token) return null;

    const res = await fetch('/api/bff/payment/create', {
      method:      'POST',
      credentials: 'include',
      headers: {
        'Content-Type':  'application/json',
        'x-csrf-token':  getCsrfToken(),
        Authorization:   `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount,
        currency:       'PI',
        payment_method: 'pi',
        metadata: {
          source:     'ecommerce',
          product_id: productId,
          memo,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[createPaymentRecord] failed:', res.status, data);
      return null;
    }

    return data?.data?.payment?.id
        ?? data?.data?.id
        ?? data?.id
        ?? null;
  } catch (err) {
    console.error('[createPaymentRecord] error:', err);
    return null;
  }
};

// ── U2A — main payment flow ───────────────────────────────
export const createU2APayment = async (
  amount:     number,
  memo:       string,
  metadata:   Record<string, unknown> = {},
  internalId: string,
): Promise<PaymentResult> => {
  if (typeof window === 'undefined') throw new Error('Open in Pi Browser');
  if (!internalId) throw new Error('Missing internalId');

  await waitForPiSdk();

  if (!window.Pi) throw new Error('Pi SDK not available');

  // authenticate
  await window.Pi.authenticate(
    ['username', 'payments'],
    async (incomplete: unknown) => {
      const p = incomplete as { identifier?: string } | null;
      if (!p?.identifier) return;
      try {
        await fetch('/api/bff/payment/complete', {
          method:      'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ payment_id: internalId, pi_payment_id: p.identifier, incomplete: true }),
        });
      } catch {}
    },
  );

  const token = getAccessToken();

  return new Promise((resolve, reject) => {
    if (!window.Pi) { reject(new Error('Pi SDK lost')); return; }

    window.Pi!.createPayment(
      { amount, memo, metadata },
      {
        onReadyForServerApproval: async (piPaymentId: string) => {
          if (!PI_PAYMENT_ID_REGEX.test(piPaymentId)) {
            reject(new Error('Invalid payment ID')); return;
          }
          try {
            const res = await fetch('/api/bff/payment/approve', {
              method:      'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': getCsrfToken(),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ payment_id: internalId, pi_payment_id: piPaymentId }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err?.message ?? `Approve failed: ${res.status}`);
            }
          } catch (err) { reject(err); }
        },

        onReadyForServerCompletion: async (piPaymentId: string, txid: string) => {
          if (!PI_PAYMENT_ID_REGEX.test(piPaymentId) || !PI_TXID_REGEX.test(txid)) {
            reject(new Error('Invalid payment data')); return;
          }
          try {
            const res = await fetch('/api/bff/payment/complete', {
              method:      'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': getCsrfToken(),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ payment_id: internalId, transaction_id: txid }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err?.message ?? `Complete failed: ${res.status}`);
            }
            resolve({ success: true, paymentId: piPaymentId, txid, amount, memo, status: 'completed', message: 'Payment successful! 🎉' });
          } catch (err) { reject(err); }
        },

        onCancel: () =>
          resolve({ success: false, status: 'cancelled', amount, memo, message: 'Payment cancelled' }),

        onError: (error: Error) =>
          reject(new Error(`Pi SDK error: ${error.message}`)),
      },
    );
  });
};
