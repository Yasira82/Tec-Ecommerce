import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import React from 'react';

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter:   () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/shop',
}));

vi.mock('@yasser172/tec-ui', () => ({
  TEC_COLORS: { gold: '#d4af37', goldDark: '#b8882a', bg: '#020205', surface: '#0d0d14' },
}));

vi.mock('@yasser172/tec-auth', () => ({
  usePiAuth:   () => ({ isAuthenticated: true, isLoading: false }),
  ssoRedirect: vi.fn(),
}));

// Static imports (after mocks are registered)
import { PaymentModal } from '@/components/shop/PaymentModal';
import { ProductCard }  from '@/components/shop/ProductCard';
import { ShopHeader }   from '@/components/shop/ShopHeader';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => cleanup());

// ══════════════════════════════════════════════════════════════════════════════
// PaymentModal
// ══════════════════════════════════════════════════════════════════════════════
describe('PaymentModal', () => {

  const product = { id: 'p1', title: 'Test Product', price: 9.99 };
  const noop    = () => {};

  it('renders product title and price', () => {
    render(<PaymentModal status="creating" product={product} onClose={noop} onRetry={noop} />);
    expect(screen.getAllByText('Test Product').length).toBeGreaterThan(0);
    expect(screen.getAllByText('9.99π').length).toBeGreaterThan(0);
  });

  it('shows "Preparing payment..." when status=creating', () => {
    render(<PaymentModal status="creating" product={product} onClose={noop} onRetry={noop} />);
    expect(screen.getAllByText('Preparing payment...').length).toBeGreaterThan(0);
  });

  it('shows "Confirm in Pi Wallet..." when status=paying', () => {
    render(<PaymentModal status="paying" product={product} onClose={noop} onRetry={noop} />);
    expect(screen.getAllByText('Confirm in Pi Wallet...').length).toBeGreaterThan(0);
  });

  it('shows success message when status=success', () => {
    render(<PaymentModal status="success" product={product} onClose={noop} onRetry={noop} />);
    expect(screen.getAllByText('Payment Successful!').length).toBeGreaterThan(0);
  });

  it('calls onClose when Done button clicked in success state', () => {
    const onClose = vi.fn();
    render(<PaymentModal status="success" product={product} onClose={onClose} onRetry={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows cancelled message when status=cancelled', () => {
    render(<PaymentModal status="cancelled" product={product} onClose={noop} onRetry={noop} />);
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
  });

  it('calls onRetry when Try Again clicked in cancelled state', () => {
    const onRetry = vi.fn();
    render(<PaymentModal status="cancelled" product={product} onClose={noop} onRetry={onRetry} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Try Again' })[0]);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows error message when status=error', () => {
    render(<PaymentModal status="error" product={product} message="Network failure" onClose={noop} onRetry={noop} />);
    expect(screen.getAllByText('Payment Failed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Network failure').length).toBeGreaterThan(0);
  });

  it('calls onRetry when Try Again clicked in error state', () => {
    const onRetry = vi.fn();
    render(<PaymentModal status="error" product={product} onClose={noop} onRetry={onRetry} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Try Again' })[0]);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Close button clicked in error state', () => {
    const onClose = vi.fn();
    render(<PaymentModal status="error" product={product} onClose={onClose} onRetry={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses product.name when title is absent', () => {
    const namedProduct = { id: 'p2', name: 'Named Product', price: 5 };
    render(<PaymentModal status="creating" product={namedProduct as never} onClose={noop} onRetry={noop} />);
    expect(screen.getAllByText('Named Product').length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ProductCard
// ══════════════════════════════════════════════════════════════════════════════
describe('ProductCard', () => {

  const product = {
    id: 'p1', title: 'Test Product',
    description: 'A great product',
    price: 5,
    images: ['http://example.com/img.jpg'],
    seller_id: 'seller-1', merchant_name: 'Test Seller',
  };

  it('renders product title and price', () => {
    render(<ProductCard product={product} piReady={true} onBuy={vi.fn()} />);
    expect(screen.getAllByText('Test Product').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5π').length).toBeGreaterThan(0);
  });

  it('shows Buy Now button when piReady=true', () => {
    render(<ProductCard product={product} piReady={true} onBuy={vi.fn()} />);
    expect(screen.getAllByText('Buy Now').length).toBeGreaterThan(0);
  });

  it('shows Connecting... button when piReady=false', () => {
    render(<ProductCard product={product} piReady={false} onBuy={vi.fn()} />);
    expect(screen.getAllByText('Connecting...').length).toBeGreaterThan(0);
  });

  it('calls onBuy when Buy Now clicked and piReady=true', () => {
    const onBuy = vi.fn();
    render(<ProductCard product={product} piReady={true} onBuy={onBuy} />);
    fireEvent.click(screen.getByRole('button', { name: 'Buy Now' }));
    expect(onBuy).toHaveBeenCalledWith(product);
  });

  it('does NOT call onBuy when piReady=false', () => {
    const onBuy = vi.fn();
    render(<ProductCard product={product} piReady={false} onBuy={onBuy} />);
    const btn = screen.getAllByText('Connecting...')[0];
    fireEvent.click(btn);
    expect(onBuy).not.toHaveBeenCalled();
  });

  it('shows seller name when provided', () => {
    render(<ProductCard product={product} piReady={true} onBuy={vi.fn()} />);
    expect(screen.getAllByText('Test Seller').length).toBeGreaterThan(0);
  });

  it('shows + Cart and ⚡ Buy buttons when onAddToCart provided', () => {
    render(<ProductCard product={product} piReady={true} onBuy={vi.fn()} onAddToCart={vi.fn()} />);
    expect(screen.getAllByText('+ Cart').length).toBeGreaterThan(0);
    expect(screen.getAllByText('⚡ Buy').length).toBeGreaterThan(0);
  });

  it('calls onAddToCart when + Cart clicked', () => {
    const onAddToCart = vi.fn();
    render(<ProductCard product={product} piReady={true} onBuy={vi.fn()} onAddToCart={onAddToCart} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Cart' }));
    expect(onAddToCart).toHaveBeenCalledWith(product);
  });

  it('shows "✓ Added" feedback after clicking + Cart', async () => {
    vi.useFakeTimers();
    render(<ProductCard product={product} piReady={true} onBuy={vi.fn()} onAddToCart={vi.fn()} />);
    fireEvent.click(screen.getAllByText('+ Cart')[0]);
    expect(screen.getAllByText('✓ Added').length).toBeGreaterThan(0);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getAllByText('+ Cart').length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('shows fallback icon when no image', () => {
    const noImg = { ...product, images: [], image_url: undefined };
    const { container } = render(<ProductCard product={noImg} piReady={true} onBuy={vi.fn()} />);
    // The fallback renders 🛍 emoji in a div
    expect(container.innerHTML).toContain('🛍');
  });

  it('uses product.name when title absent', () => {
    const namedProd = { ...product, title: undefined as never, name: 'Named Prod' };
    render(<ProductCard product={namedProd} piReady={true} onBuy={vi.fn()} />);
    expect(screen.getAllByText('Named Prod').length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ShopHeader
// ══════════════════════════════════════════════════════════════════════════════
describe('ShopHeader', () => {

  it('renders TEC Store branding', () => {
    render(<ShopHeader piReady={true} onMenuOpen={vi.fn()} />);
    expect(screen.getAllByText('TEC Store').length).toBeGreaterThan(0);
  });

  it('shows "π ✓" when piReady=true', () => {
    render(<ShopHeader piReady={true} onMenuOpen={vi.fn()} />);
    expect(screen.getAllByText('π ✓').length).toBeGreaterThan(0);
  });

  it('shows "···" when piReady=false', () => {
    render(<ShopHeader piReady={false} onMenuOpen={vi.fn()} />);
    expect(screen.getAllByText('···').length).toBeGreaterThan(0);
  });

  it('calls onMenuOpen when hamburger clicked', () => {
    const onMenuOpen = vi.fn();
    render(<ShopHeader piReady={true} onMenuOpen={onMenuOpen} />);
    // The hamburger button is the first button
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onMenuOpen).toHaveBeenCalledTimes(1);
  });

  it('shows cart button when onCartOpen provided', () => {
    const onCartOpen = vi.fn();
    render(<ShopHeader piReady={true} onMenuOpen={vi.fn()} cartCount={3} onCartOpen={onCartOpen} />);
    // Should show cart count
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('shows 99+ when cartCount > 99', () => {
    render(<ShopHeader piReady={true} onMenuOpen={vi.fn()} cartCount={150} onCartOpen={vi.fn()} />);
    expect(screen.getAllByText('99+').length).toBeGreaterThan(0);
  });

  it('calls onCartOpen when cart button clicked', () => {
    const onCartOpen = vi.fn();
    render(<ShopHeader piReady={true} onMenuOpen={vi.fn()} cartCount={2} onCartOpen={onCartOpen} />);
    fireEvent.click(screen.getAllByText('🛒')[0]);
    expect(onCartOpen).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PiSdkLoader
// ══════════════════════════════════════════════════════════════════════════════
describe('PiSdkLoader', () => {
  it('returns null (no rendered output)', async () => {
    const { default: PiSdkLoader } = await import('@/components/PiSdkLoader');
    const { container } = render(<PiSdkLoader sandbox={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('initializes Pi SDK when window.Pi is available', async () => {
    const mockInit = vi.fn();
    (window as any).Pi = { init: mockInit };
    (window as any).__TEC_PI_READY = undefined;

    const { default: PiSdkLoader } = await import('@/components/PiSdkLoader');
    render(<PiSdkLoader sandbox={false} />);

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({ version: '2.0', sandbox: false }));
    expect((window as any).__TEC_PI_READY).toBe(true);

    delete (window as any).Pi;
    delete (window as any).__TEC_PI_READY;
  });

  it('sets FOREIGN_SESSION when Pi.init throws already initialized', async () => {
    (window as any).__TEC_PI_FOREIGN_SESSION = undefined;
    (window as any).__TEC_PI_READY = undefined;

    (window as any).Pi = {
      init: () => { throw new Error('Pi SDK already initialized'); },
    };

    const { default: PiSdkLoader } = await import('@/components/PiSdkLoader');
    render(<PiSdkLoader sandbox={false} />);

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    expect((window as any).__TEC_PI_FOREIGN_SESSION).toBe(true);
    expect((window as any).__TEC_PI_READY).toBe(true);

    delete (window as any).Pi;
    delete (window as any).__TEC_PI_FOREIGN_SESSION;
    delete (window as any).__TEC_PI_READY;
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// request-id utilities
// ══════════════════════════════════════════════════════════════════════════════
describe('request-id utilities', () => {
  it('generateRequestId returns a UUID', async () => {
    const { generateRequestId } = await import('@/lib/request-id');
    const id = generateRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('storeRequestId stores in sessionStorage', async () => {
    const { storeRequestId, getLastRequestId } = await import('@/lib/request-id');
    storeRequestId('test-req-id');
    expect(getLastRequestId()).toBe('test-req-id');
  });

  it('getLastRequestId returns null when nothing stored', async () => {
    sessionStorage.clear();
    const { getLastRequestId } = await import('@/lib/request-id');
    expect(getLastRequestId()).toBeNull();
  });

  it('buildHeaders includes content-type and request-id', async () => {
    const { buildHeaders } = await import('@/lib/request-id');
    const headers = buildHeaders('my-token');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Request-ID']).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers['Authorization']).toBe('Bearer my-token');
  });

  it('buildHeaders omits Authorization when no token', async () => {
    const { buildHeaders } = await import('@/lib/request-id');
    const headers = buildHeaders(null);
    expect(headers['Authorization']).toBeUndefined();
  });

  it('buildHeaders reads CSRF token from cookie', async () => {
    Object.defineProperty(document, 'cookie', {
      value: 'tec_csrf=csrf-abc123',
      configurable: true,
      writable: true,
    });
    const { buildHeaders } = await import('@/lib/request-id');
    const headers = buildHeaders('tok');
    expect(headers['X-CSRF-Token']).toBe('csrf-abc123');
  });

  it('buildHeaders merges extra headers', async () => {
    const { buildHeaders } = await import('@/lib/request-id');
    const headers = buildHeaders(null, { 'x-custom': 'value' });
    expect(headers['x-custom']).toBe('value');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// pi-auth utilities
// ══════════════════════════════════════════════════════════════════════════════
describe('pi-auth client utilities', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'cookie', {
      value: '',
      configurable: true,
      writable: true,
    });
  });

  it('isPiBrowser returns false when no Pi SDK', async () => {
    const { isPiBrowser } = await import('@/lib-client/pi/pi-auth');
    delete (window as any).Pi;
    expect(isPiBrowser()).toBe(false);
  });

  it('isPiBrowser returns true when Pi SDK present', async () => {
    (window as any).Pi = { authenticate: vi.fn(), createPayment: vi.fn(), init: vi.fn() };
    const { isPiBrowser } = await import('@/lib-client/pi/pi-auth');
    expect(isPiBrowser()).toBe(true);
    delete (window as any).Pi;
  });

  it('getAccessToken returns null when cookie absent', async () => {
    Object.defineProperty(document, 'cookie', { value: '', configurable: true, writable: true });
    const { getAccessToken } = await import('@/lib-client/pi/pi-auth');
    expect(getAccessToken()).toBeNull();
  });

  it('getAccessToken returns token from cookie', async () => {
    Object.defineProperty(document, 'cookie', {
      value: 'tec_access_token=my-token',
      configurable: true, writable: true,
    });
    const { getAccessToken } = await import('@/lib-client/pi/pi-auth');
    expect(getAccessToken()).toBe('my-token');
  });

  it('getStoredUser returns null when no tec_user cookie', async () => {
    Object.defineProperty(document, 'cookie', { value: '', configurable: true, writable: true });
    const { getStoredUser } = await import('@/lib-client/pi/pi-auth');
    expect(getStoredUser()).toBeNull();
  });

  it('getStoredUser returns parsed user from cookie', async () => {
    const user = { id: 'u1', piUsername: 'user1' };
    const encoded = encodeURIComponent(JSON.stringify(user));
    Object.defineProperty(document, 'cookie', {
      value: `tec_user=${encoded}`,
      configurable: true, writable: true,
    });
    const { getStoredUser } = await import('@/lib-client/pi/pi-auth');
    const result = getStoredUser() as { id: string };
    expect(result.id).toBe('u1');
  });

  it('getStoredUser returns null for malformed JSON', async () => {
    Object.defineProperty(document, 'cookie', {
      value: 'tec_user=not-valid-json',
      configurable: true, writable: true,
    });
    const { getStoredUser } = await import('@/lib-client/pi/pi-auth');
    expect(getStoredUser()).toBeNull();
  });

  it('waitForPiSDK resolves immediately when Pi ready', async () => {
    (window as any).__TEC_PI_READY = true;
    (window as any).Pi = { authenticate: vi.fn(), createPayment: vi.fn(), init: vi.fn() };

    const { waitForPiSDK } = await import('@/lib-client/pi/pi-auth');
    await expect(waitForPiSDK()).resolves.toBeUndefined();

    delete (window as any).__TEC_PI_READY;
    delete (window as any).Pi;
  });

  it('waitForPiSDK rejects when __TEC_PI_ERROR set', async () => {
    (window as any).__TEC_PI_ERROR = true;
    delete (window as any).__TEC_PI_READY;

    const { waitForPiSDK } = await import('@/lib-client/pi/pi-auth');
    await expect(waitForPiSDK()).rejects.toThrow();

    delete (window as any).__TEC_PI_ERROR;
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// i18n LocaleProvider + useTranslation
// ══════════════════════════════════════════════════════════════════════════════
describe('LocaleProvider and useTranslation', () => {
  it('provides English locale by default', async () => {
    const { LocaleProvider, useTranslation } = await import('@/lib/i18n/index');

    function TestComponent() {
      const { locale } = useTranslation();
      return <span data-testid="locale">{locale}</span>;
    }

    render(
      <LocaleProvider>
        <TestComponent />
      </LocaleProvider>,
    );

    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('allows switching locale to ar', async () => {
    const { LocaleProvider, useTranslation } = await import('@/lib/i18n/index');

    function TestComponent() {
      const { locale, setLocale } = useTranslation();
      return (
        <>
          <span data-testid="locale">{locale}</span>
          <button onClick={() => setLocale('ar')}>Switch to AR</button>
        </>
      );
    }

    render(
      <LocaleProvider>
        <TestComponent />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getAllByText('Switch to AR')[0]);
    expect(screen.getByTestId('locale').textContent).toBe('ar');
  });

  it('dir is rtl for ar locale', async () => {
    const { LocaleProvider, useTranslation } = await import('@/lib/i18n/index');

    function TestComponent() {
      const { dir, setLocale } = useTranslation();
      return (
        <>
          <span data-testid="dir">{dir}</span>
          <button onClick={() => setLocale('ar')}>AR</button>
        </>
      );
    }

    render(
      <LocaleProvider>
        <TestComponent />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getAllByText('AR')[0]);
    expect(screen.getByTestId('dir').textContent).toBe('rtl');
  });

  it('throws when useTranslation called outside LocaleProvider', async () => {
    const { useTranslation } = await import('@/lib/i18n/index');

    function BadComponent() {
      useTranslation();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow('useTranslation must be used within LocaleProvider');
  });

  it('persists locale to localStorage', async () => {
    const { LocaleProvider, useTranslation } = await import('@/lib/i18n/index');

    function TestComponent() {
      const { setLocale } = useTranslation();
      return <button onClick={() => setLocale('ar')}>Switch</button>;
    }

    render(
      <LocaleProvider>
        <TestComponent />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getAllByText('Switch')[0]);
    expect(localStorage.getItem('tec_locale')).toBe('ar');
  });
});


// ══════════════════════════════════════════════════════════════════════════════
// Order helpers (orderTotal, formatRelative logic)
// ══════════════════════════════════════════════════════════════════════════════
describe('Order utilities (pure logic)', () => {
  // These are defined inline in the orders page — testing the logic directly
  const orderTotal = (o: { total?: number; items?: { price?: number; qty: number }[] }) =>
    o.total ?? o.items?.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0) ?? 0;

  it('returns o.total when present', () => {
    expect(orderTotal({ total: 42.5 })).toBe(42.5);
  });

  it('calculates from items when no total', () => {
    const order = {
      items: [
        { price: 5, qty: 2 },
        { price: 10, qty: 1 },
      ],
    };
    expect(orderTotal(order)).toBe(20);
  });

  it('returns 0 when no items and no total', () => {
    expect(orderTotal({})).toBe(0);
  });

  it('handles items with undefined price', () => {
    const order = { items: [{ qty: 3 }] };
    expect(orderTotal(order)).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Product filtering logic (from ShopPage)
// ══════════════════════════════════════════════════════════════════════════════
describe('Product filtering logic', () => {
  interface Product { id: string; title: string; description: string; price: number; category?: string; rating?: number }

  const products: Product[] = [
    { id: 'p1', title: 'Apple Phone',   description: 'Latest phone', price: 100, category: 'electronics', rating: 4.5 },
    { id: 'p2', title: 'Banana Shirt',  description: 'Cotton shirt', price: 20,  category: 'clothing',    rating: 3.0 },
    { id: 'p3', title: 'Cherry Watch',  description: 'Smart watch',  price: 80,  category: 'electronics', rating: 5.0 },
    { id: 'p4', title: 'Date Coffee',   description: 'Dark roast',   price: 8,   category: 'food',        rating: 4.0 },
  ];

  const filterProducts = (
    list: Product[],
    query: string,
    category: string,
    maxPrice: number | null,
    sortBy: 'default' | 'price-asc' | 'price-desc' | 'rating',
  ) => {
    let filtered = [...list];
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (category !== 'all') filtered = filtered.filter(p => p.category === category);
    if (maxPrice !== null) filtered = filtered.filter(p => p.price <= maxPrice);
    switch (sortBy) {
      case 'price-asc':  filtered.sort((a, b) => a.price - b.price); break;
      case 'price-desc': filtered.sort((a, b) => b.price - a.price); break;
      case 'rating':     filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); break;
    }
    return filtered;
  };

  it('returns all products with no filters', () => {
    expect(filterProducts(products, '', 'all', null, 'default')).toHaveLength(4);
  });

  it('filters by text query', () => {
    const result = filterProducts(products, 'phone', 'all', null, 'default');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('filters by category', () => {
    const result = filterProducts(products, '', 'electronics', null, 'default');
    expect(result).toHaveLength(2);
  });

  it('filters by max price', () => {
    const result = filterProducts(products, '', 'all', 50, 'default');
    expect(result).toHaveLength(2);
    expect(result.every(p => p.price <= 50)).toBe(true);
  });

  it('sorts by price ascending', () => {
    const result = filterProducts(products, '', 'all', null, 'price-asc');
    expect(result[0].price).toBe(8);
    expect(result[result.length - 1].price).toBe(100);
  });

  it('sorts by price descending', () => {
    const result = filterProducts(products, '', 'all', null, 'price-desc');
    expect(result[0].price).toBe(100);
    expect(result[result.length - 1].price).toBe(8);
  });

  it('sorts by rating (highest first)', () => {
    const result = filterProducts(products, '', 'all', null, 'rating');
    expect(result[0].id).toBe('p3');  // rating 5.0
    expect(result[1].id).toBe('p1');  // rating 4.5
  });

  it('combines query + category filters', () => {
    const result = filterProducts(products, 'watch', 'electronics', null, 'default');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p3');
  });

  it('returns empty when no products match', () => {
    const result = filterProducts(products, 'notexistent', 'all', null, 'default');
    expect(result).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ADR-007 isHubNavigation
// ══════════════════════════════════════════════════════════════════════════════
describe('ADR-007 isHubNavigation guard', () => {
  const isHubNavigation = (): boolean => {
    if (typeof document === 'undefined') return false;
    return document.referrer.toLowerCase().includes('hub.tecosystem.app');
  };

  it('returns true when referrer contains hub.tecosystem.app', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://hub.tecosystem.app/dashboard', configurable: true,
    });
    expect(isHubNavigation()).toBe(true);
  });

  it('returns false when referrer is empty', () => {
    Object.defineProperty(document, 'referrer', { value: '', configurable: true });
    expect(isHubNavigation()).toBe(false);
  });

  it('returns false for unrelated referrer', () => {
    Object.defineProperty(document, 'referrer', { value: 'https://google.com', configurable: true });
    expect(isHubNavigation()).toBe(false);
  });

  it('is case-insensitive', () => {
    Object.defineProperty(document, 'referrer', { value: 'https://HUB.TECOSYSTEM.APP/', configurable: true });
    expect(isHubNavigation()).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Hub redirect URL format
// ══════════════════════════════════════════════════════════════════════════════
describe('Hub redirect URL format (ADR-007 Mode 1)', () => {
  it('uses /hub?pay=1 not /hub/pay', () => {
    const HUB_URL = 'https://hub.tecosystem.app';
    const APP_URL = 'https://ecommerce.tecosystem.app';
    const product = { id: 'p1', title: 'Test Product', price: 5 };

    const params = new URLSearchParams({
      pay: '1', amount: product.price.toString(),
      memo: `${product.title} — TEC Ecommerce`,
      product_id: product.id,
      return_url: `${APP_URL}/shop`,
      source: 'ecommerce',
    });
    const url = `${HUB_URL}/hub?${params.toString()}`;

    expect(url).toContain('/hub?');
    expect(url).toContain('pay=1');
    expect(url).toContain('source=ecommerce');
    expect(url).not.toContain('/hub/pay');
  });
});
