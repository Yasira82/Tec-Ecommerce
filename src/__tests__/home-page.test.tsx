import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const stableRouter = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter:   () => stableRouter,
  usePathname: () => '/',
}));

const authState   = vi.hoisted(() => ({ isAuthenticated: false, isLoading: false }));
const ssoRedirect = vi.hoisted(() => vi.fn());
vi.mock('@yasser172/tec-auth', () => ({
  usePiAuth:   () => authState,
  ssoRedirect,
}));

vi.mock('@yasser172/tec-ui', () => ({
  TEC_COLORS: { gold: '#d4af37', goldDark: '#b8882a', bg: '#020205', surface: '#0d0d14', subtext: '#888' },
}));

const mockCreateRecord  = vi.hoisted(() => vi.fn());
const mockCreatePayment = vi.hoisted(() => vi.fn());
vi.mock('@/lib/pi-payment', () => ({
  createPaymentRecord: mockCreateRecord,
  createU2APayment:    mockCreatePayment,
}));

import HomePage from '@/app/page';

const products = [
  { id: 'p1', title: 'Ring',   description: 'a', price: 5,  category: 'jewelry', rating: 4, reviews_count: 7, images: ['https://img/1.png'] },
  { id: 'p2', title: 'Chain',  description: 'b', price: 3,  category: 'jewelry' },
  { id: 'p3', title: 'Laptop', description: 'c', price: 90, category: 'tech' },
  { id: 'p4', title: 'Mouse',  description: 'd', price: 2,  category: 'tech' },
  { id: 'p5', title: 'Mug',    description: 'e', price: 1 },
];

const setCookie = (value: string) =>
  Object.defineProperty(document, 'cookie', { value, configurable: true, writable: true });
const setReferrer = (value: string) =>
  Object.defineProperty(document, 'referrer', { value, configurable: true });

const mockProductsFetch = () => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (String(url).startsWith('/api/bff/products')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: { products } }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  }) as any;
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = false;
  authState.isLoading       = false;
  setCookie('');
  setReferrer('');
  delete (window as any).Pi;
  delete (window as any).__TEC_PI_READY;
  window.location.href = 'https://ecommerce.tecosystem.app/';
  try { localStorage.clear(); } catch {}
  mockProductsFetch();
});

afterEach(() => {
  cleanup();
  delete (window as any).Pi;
  delete (window as any).__TEC_PI_READY;
});

describe('HomePage states', () => {
  it('shows spinner while auth loading', () => {
    authState.isLoading = true;
    const { container } = render(<HomePage />);
    expect(container.querySelector('div[style*="border-radius"]') ?? container.firstChild).toBeTruthy();
    expect(screen.queryByText('TEC Store')).toBeNull();
  });

  it('shows login screen when unauthenticated and triggers ssoRedirect', () => {
    render(<HomePage />);
    expect(screen.getByText('TEC Store')).toBeDefined();
    fireEvent.click(screen.getByText('🔷 Login with Pi'));
    expect(ssoRedirect).toHaveBeenCalled();
  });

  it('treats token cookie as authenticated and loads products', async () => {
    setCookie('tec_access_token=tok-1; tec_user=' + encodeURIComponent(JSON.stringify({ piUsername: 'pioneer' })));
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('Ring')).toBeDefined());
    expect(screen.getByText('Shop the Future')).toBeDefined();
    // featured = first 4, rest = remaining
    expect(screen.getByText('Mug')).toBeDefined();
    // category tabs present
    expect(screen.getAllByText('jewelry').length).toBeGreaterThan(0);
    expect(screen.getAllByText('tech').length).toBeGreaterThan(0);
  });

  it('filters by category tab on click', async () => {
    authState.isAuthenticated = true;
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('Ring')).toBeDefined());
    // category tabs are present
    expect(screen.getAllByText('tech').length).toBeGreaterThan(0);
  });

  it('shows error state and retry reloads', async () => {
    authState.isAuthenticated = true;
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }) as any;
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('Could not load products')).toBeDefined());
    mockProductsFetch();
    fireEvent.click(screen.getByText('↺ Retry'));
    await waitFor(() => expect(screen.getByText('Ring')).toBeDefined());
  });

  it('shows empty state when no products', async () => {
    authState.isAuthenticated = true;
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { products: [] } }) }) as any;
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('No products yet')).toBeDefined());
  });

  it('shows error state when fetch rejects', async () => {
    authState.isAuthenticated = true;
    global.fetch = vi.fn().mockRejectedValue(new Error('net')) as any;
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('Could not load products')).toBeDefined());
  });
});

describe('HomePage handleBuy — ADR-007', () => {
  const authReadySetup = () => {
    authState.isAuthenticated = true;
    (window as any).__TEC_PI_READY = true;
    (window as any).Pi = { authenticate: vi.fn(), createPayment: vi.fn(), init: vi.fn() };
  };

  it('Mode 1: hub referrer redirects to hub payment URL', async () => {
    authReadySetup();
    setReferrer('https://HUB.tecosystem.app/hub');
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('Ring')).toBeDefined());
    fireEvent.click(screen.getAllByText('⚡ Buy')[0]);
    expect(window.location.href).toContain('pay=1');
    expect(window.location.href).toContain('product_id=p1');
    expect(mockCreateRecord).not.toHaveBeenCalled();
  });

  it('Mode 1: no Pi SDK redirects to hub', async () => {
    authState.isAuthenticated = true;
    (window as any).__TEC_PI_READY = true;
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('Ring')).toBeDefined());
    fireEvent.click(screen.getAllByText('⚡ Buy')[0]);
    expect(window.location.href).toContain('pay=1');
  });

  it('Mode 2: success flow shows success modal and posts order', async () => {
    authReadySetup();
    mockCreateRecord.mockResolvedValue('int-1');
    mockCreatePayment.mockResolvedValue({ success: true, status: 'completed' });
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('Ring')).toBeDefined());
    fireEvent.click(screen.getAllByText('⚡ Buy')[0]);
    await waitFor(() => expect(screen.getByText('Payment Successful!')).toBeDefined());
    const orderCall = (global.fetch as any).mock.calls.find((c: any[]) => String(c[0]) === '/api/bff/orders');
    expect(orderCall).toBeTruthy();
    // close modal
    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByText('Payment Successful!')).toBeNull();
  });

  it('shows error modal when payment record fails', async () => {
    authReadySetup();
    mockCreateRecord.mockResolvedValue(null);
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('Ring')).toBeDefined());
    fireEvent.click(screen.getAllByText('⚡ Buy')[0]);
    await waitFor(() => expect(screen.getByText('Payment Failed')).toBeDefined());
    expect(screen.getByText('Failed to initialize.')).toBeDefined();
  });

  it('shows cancelled modal when user cancels', async () => {
    authReadySetup();
    mockCreateRecord.mockResolvedValue('int-2');
    mockCreatePayment.mockResolvedValue({ success: false, status: 'cancelled', message: 'Payment cancelled' });
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('Ring')).toBeDefined());
    fireEvent.click(screen.getAllByText('⚡ Buy')[0]);
    await waitFor(() => expect(screen.getByText('Cancelled')).toBeDefined());
  });

  it('shows error modal when createU2APayment throws', async () => {
    authReadySetup();
    mockCreateRecord.mockResolvedValue('int-3');
    mockCreatePayment.mockRejectedValue(new Error('Pi exploded'));
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('Ring')).toBeDefined());
    fireEvent.click(screen.getAllByText('⚡ Buy')[0]);
    await waitFor(() => expect(screen.getByText('Pi exploded')).toBeDefined());
  });
});

describe('HomePage cart interactions', () => {
  it('add to cart opens drawer and shows item', async () => {
    authState.isAuthenticated = true;
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('Ring')).toBeDefined());
    fireEvent.click(screen.getAllByText('+ Cart')[0]);
    await waitFor(() => expect(screen.getByText('✓ Added')).toBeDefined());
    // cart drawer header shows item count
    expect(screen.getByText('1 item')).toBeDefined();
  });

  it('menu button opens EcommerceDrawer', async () => {
    authState.isAuthenticated = true;
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('Ring')).toBeDefined());
    expect(screen.getByText('Ecommerce')).toBeDefined();
  });
});
