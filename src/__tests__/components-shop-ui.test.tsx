import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// ── stable next/navigation singletons (NEVER recreate per call) ──
const stableRouter = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter:       () => stableRouter,
  usePathname:     () => '/shop',
  useSearchParams: () => new URLSearchParams(),
  useParams:       () => ({ id: 'm-1' }),
}));

vi.mock('@yasser172/tec-ui', () => ({
  TEC_COLORS: { gold: '#d4af37', goldDark: '#b8882a', bg: '#020205', surface: '#0d0d14', subtext: '#888' },
}));

import { ShopHeader }      from '@/components/shop/ShopHeader';
import { PaymentModal }    from '@/components/shop/PaymentModal';
import { ProductCard }     from '@/components/shop/ProductCard';
import { ProductGrid }     from '@/components/shop/ProductGrid';
import { ShopHero }        from '@/components/shop/ShopHero';
import { EcommerceDrawer } from '@/components/shop/EcommerceDrawer';
import { ErrorBoundary }   from '@/components/ErrorBoundary';

const product = {
  id: 'p1', title: 'Gold Ring', description: 'Shiny ring', price: 5,
  images: ['https://img/x.png'], seller_id: 'seller-1', merchant_name: 'goldsmith',
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({}),
  }) as unknown as typeof fetch;
});

afterEach(() => cleanup());

// ── ShopHeader ────────────────────────────────────────────────
describe('ShopHeader', () => {
  it('renders nav and pi status off', () => {
    render(<ShopHeader piReady={false} onMenuOpen={vi.fn()} />);
    expect(screen.getByText('TEC Store')).toBeDefined();
    expect(screen.getByText('···')).toBeDefined();
  });

  it('renders pi ready badge and cart count', () => {
    const onCartOpen = vi.fn();
    render(<ShopHeader piReady onMenuOpen={vi.fn()} cartCount={3} onCartOpen={onCartOpen} />);
    expect(screen.getByText('π ✓')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    fireEvent.click(screen.getByText('🛒'));
    expect(onCartOpen).toHaveBeenCalled();
  });

  it('caps cart count display at 99+', () => {
    render(<ShopHeader piReady onMenuOpen={vi.fn()} cartCount={120} onCartOpen={vi.fn()} />);
    expect(screen.getByText('99+')).toBeDefined();
  });

  it('navigates via nav buttons and menu button works', () => {
    const onMenuOpen = vi.fn();
    render(<ShopHeader piReady onMenuOpen={onMenuOpen} />);
    fireEvent.click(screen.getByText('🧾 Orders'));
    expect(stableRouter.push).toHaveBeenCalledWith('/orders');
    fireEvent.click(screen.getByText('🏪 Sell'));
    expect(stableRouter.push).toHaveBeenCalledWith('/merchant');
    fireEvent.click(screen.getByText('🛍 Shop'));
    expect(stableRouter.push).toHaveBeenCalledWith('/shop');
  });
});

// ── PaymentModal ──────────────────────────────────────────────
describe('PaymentModal', () => {
  const base = { product: { id: 'p1', title: 'Gold Ring', price: 5 }, onClose: vi.fn(), onRetry: vi.fn() };

  it('renders creating state spinner', () => {
    render(<PaymentModal {...base} status="creating" />);
    expect(screen.getByText('Preparing payment...')).toBeDefined();
  });

  it('renders paying state', () => {
    render(<PaymentModal {...base} status="paying" />);
    expect(screen.getByText('Confirm in Pi Wallet...')).toBeDefined();
  });

  it('renders success state and Done closes', () => {
    const onClose = vi.fn();
    render(<PaymentModal {...base} status="success" onClose={onClose} />);
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders cancelled state with retry', () => {
    const onRetry = vi.fn();
    render(<PaymentModal {...base} status="cancelled" onRetry={onRetry} />);
    expect(screen.getByText('Cancelled')).toBeDefined();
    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders error state with message', () => {
    render(<PaymentModal {...base} status="error" message="boom" />);
    expect(screen.getByText('Payment Failed')).toBeDefined();
    expect(screen.getByText('boom')).toBeDefined();
  });
});

// ── ProductCard ───────────────────────────────────────────────
describe('ProductCard', () => {
  it('renders product with image, seller link and buy button', () => {
    const onBuy = vi.fn();
    render(<ProductCard product={product} piReady onBuy={onBuy} onAddToCart={vi.fn()} />);
    expect(screen.getByText('Gold Ring')).toBeDefined();
    expect(screen.getByText('5π')).toBeDefined();
    fireEvent.click(screen.getByText('⚡ Buy'));
    expect(onBuy).toHaveBeenCalledWith(product);
  });

  it('navigates to seller store on merchant click', () => {
    render(<ProductCard product={product} piReady onBuy={vi.fn()} onAddToCart={vi.fn()} />);
    fireEvent.click(screen.getByText('goldsmith'));
    expect(stableRouter.push).toHaveBeenCalledWith('/store/seller-1');
  });

  it('add-to-cart shows added state and opens cart', () => {
    const onAdd = vi.fn(); const onCartOpen = vi.fn();
    render(<ProductCard product={product} piReady onBuy={vi.fn()} onAddToCart={onAdd} onCartOpen={onCartOpen} />);
    fireEvent.click(screen.getByText('+ Cart'));
    expect(onAdd).toHaveBeenCalledWith(product);
    expect(onCartOpen).toHaveBeenCalled();
    expect(screen.getByText('✓ Added')).toBeDefined();
  });

  it('renders fallback placeholder when no image, single Buy Now mode', () => {
    const bare = { id: 'p2', title: 'NoImg', description: 'd', price: 2 };
    render(<ProductCard product={bare} piReady={false} onBuy={vi.fn()} />);
    expect(screen.getByText('Connecting...')).toBeDefined();
    expect(screen.getByText('🛍')).toBeDefined();
  });

  it('image error swaps to placeholder', () => {
    render(<ProductCard product={product} piReady onBuy={vi.fn()} />);
    fireEvent.error(screen.getByAltText('Gold Ring'));
    expect(screen.getByText('🛍')).toBeDefined();
  });

  it('buy disabled (···) when pi not ready in cart mode', () => {
    const onBuy = vi.fn();
    render(<ProductCard product={product} piReady={false} onBuy={onBuy} onAddToCart={vi.fn()} />);
    fireEvent.click(screen.getByText('···'));
    expect(onBuy).not.toHaveBeenCalled();
  });
});

// ── ProductGrid ───────────────────────────────────────────────
describe('ProductGrid', () => {
  it('renders empty state', () => {
    render(<ProductGrid products={[]} piReady onBuy={vi.fn()} />);
    expect(screen.getByText('No products yet')).toBeDefined();
  });

  it('renders product cards', () => {
    render(<ProductGrid products={[product, { ...product, id: 'p9', title: 'Second' }]} piReady onBuy={vi.fn()} />);
    expect(screen.getByText('Gold Ring')).toBeDefined();
    expect(screen.getByText('Second')).toBeDefined();
  });
});

// ── ShopHero ──────────────────────────────────────────────────
describe('ShopHero', () => {
  it('renders title and username when given', () => {
    render(<ShopHero username="pioneer" />);
    expect(screen.getByText('TEC Store')).toBeDefined();
    expect(screen.getByText('@pioneer')).toBeDefined();
  });

  it('renders without username', () => {
    render(<ShopHero />);
    expect(screen.getByText('π Mainnet')).toBeDefined();
  });
});

// ── EcommerceDrawer ───────────────────────────────────────────
describe('EcommerceDrawer', () => {
  it('renders closed without overlay', () => {
    const { container } = render(<EcommerceDrawer isOpen={false} onClose={vi.fn()} hubUrl="https://hub.test" />);
    expect(screen.getByText('Ecommerce')).toBeDefined();
    expect(container.querySelectorAll('div[style*="backdrop"]').length).toBe(0);
  });

  it('renders open with username and toggles preferences', () => {
    render(<EcommerceDrawer isOpen onClose={vi.fn()} username="pioneer" hubUrl="https://hub.test" />);
    expect(screen.getByText('@pioneer')).toBeDefined();
    // dark mode toggle flips label
    expect(screen.getByText('Dark Mode')).toBeDefined();
    const toggles = screen.getAllByRole('button').filter(b => b.style.width === '44px');
    fireEvent.click(toggles[0]);
    expect(screen.getByText('Light Mode')).toBeDefined();
  });

  it('overlay click calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<EcommerceDrawer isOpen onClose={onClose} hubUrl="https://hub.test" />);
    const overlay = container.firstElementChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('clear cache shows done indicator', () => {
    render(<EcommerceDrawer isOpen onClose={vi.fn()} hubUrl="https://hub.test" />);
    fireEvent.click(screen.getByText('Clear Cache'));
    expect(screen.getByText('✓ Done')).toBeDefined();
  });

  it('share uses clipboard fallback when navigator.share missing', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(window, 'alert', { value: vi.fn(), writable: true, configurable: true });
    render(<EcommerceDrawer isOpen onClose={vi.fn()} hubUrl="https://hub.test" />);
    fireEvent.click(screen.getByText('Share App'));
    expect(writeText).toHaveBeenCalled();
  });
});

// ── ErrorBoundary ─────────────────────────────────────────────
describe('ErrorBoundary', () => {
  function Boom(): never { throw new Error('kaboom'); }

  it('renders children when no error', () => {
    render(<ErrorBoundary><div>safe child</div></ErrorBoundary>);
    expect(screen.getByText('safe child')).toBeDefined();
  });

  it('renders default fallback on error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.getByText('kaboom')).toBeDefined();
    spy.mockRestore();
  });

  it('renders custom fallback when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary fallback={<div>custom fallback</div>}><Boom /></ErrorBoundary>);
    expect(screen.getByText('custom fallback')).toBeDefined();
    spy.mockRestore();
  });
});
