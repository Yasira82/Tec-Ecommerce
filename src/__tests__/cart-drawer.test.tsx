import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const stableRouter = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter:   () => stableRouter,
  usePathname: () => '/',
}));

const mockCreateRecord  = vi.hoisted(() => vi.fn());
const mockCreatePayment = vi.hoisted(() => vi.fn());
vi.mock('@/lib/pi-payment', () => ({
  createPaymentRecord: mockCreateRecord,
  createU2APayment:    mockCreatePayment,
}));

import { CartDrawer } from '@/components/shop/CartDrawer';
import type { CartItem } from '@/lib-client/cart/useCart';

const items: CartItem[] = [
  { product: { id: 'p1', title: 'Ring',  price: 5, images: ['https://img/1.png'] }, qty: 2 },
  { product: { id: 'p2', title: 'Chain', price: 3 }, qty: 1 },
];

const baseProps = {
  isOpen: true, onClose: vi.fn(), items,
  onUpdateQty: vi.fn(), onRemove: vi.fn(), onClear: vi.fn(), piReady: true,
};

const setReferrer = (value: string) =>
  Object.defineProperty(document, 'referrer', { value, configurable: true });

beforeEach(() => {
  vi.clearAllMocks();
  setReferrer('');
  (window as any).Pi = { authenticate: vi.fn(), createPayment: vi.fn(), init: vi.fn() };
  window.location.href = 'https://ecommerce.tecosystem.app/';
  Object.defineProperty(document, 'cookie', {
    value: 'tec_access_token=tok; tec_csrf=csrf-1', configurable: true, writable: true,
  });
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }) as any;
});

afterEach(() => {
  cleanup();
  delete (window as any).Pi;
});

describe('CartDrawer rendering', () => {
  it('renders empty cart message', () => {
    render(<CartDrawer {...baseProps} items={[]} />);
    expect(screen.getByText('Your cart is empty')).toBeDefined();
  });

  it('renders items, totals and qty controls', () => {
    render(<CartDrawer {...baseProps} />);
    expect(screen.getByText('Ring')).toBeDefined();
    expect(screen.getByText('Chain')).toBeDefined();
    expect(screen.getByText('13.00π')).toBeDefined();       // total 2*5 + 3
    expect(screen.getByText('Total (3 items)')).toBeDefined();
  });

  it('qty +/- and remove call handlers', () => {
    render(<CartDrawer {...baseProps} />);
    fireEvent.click(screen.getAllByText('+')[0]);
    expect(baseProps.onUpdateQty).toHaveBeenCalledWith('p1', 3);
    fireEvent.click(screen.getAllByText('−')[0]);
    expect(baseProps.onUpdateQty).toHaveBeenCalledWith('p1', 1);
    fireEvent.click(screen.getAllByText('🗑')[0]);
    expect(baseProps.onRemove).toHaveBeenCalledWith('p1');
  });

  it('clear all and close buttons work', () => {
    render(<CartDrawer {...baseProps} />);
    fireEvent.click(screen.getByText('Clear all'));
    expect(baseProps.onClear).toHaveBeenCalled();
    fireEvent.click(screen.getByText('×'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });
});

describe('CartDrawer checkout — ADR-007', () => {
  it('Mode 1: redirects to Hub when referrer is hub.tecosystem.app', () => {
    setReferrer('https://hub.tecosystem.app/hub');
    render(<CartDrawer {...baseProps} />);
    fireEvent.click(screen.getByText('🔷 Checkout with Pi'));
    expect(window.location.href).toContain('hub.tecosystem.app/hub?');
    expect(window.location.href).toContain('pay=1');
    expect(window.location.href).toContain('product_id=cart_checkout');
    expect(mockCreateRecord).not.toHaveBeenCalled();
  });

  it('Mode 1: redirects to Hub when Pi SDK missing', () => {
    delete (window as any).Pi;
    render(<CartDrawer {...baseProps} />);
    fireEvent.click(screen.getByText('🔷 Checkout with Pi'));
    expect(window.location.href).toContain('pay=1');
    expect(mockCreateRecord).not.toHaveBeenCalled();
  });

  it('Mode 1: redirects to Hub when piReady is false', () => {
    render(<CartDrawer {...baseProps} piReady={false} />);
    fireEvent.click(screen.getByText('🔷 Checkout with Pi'));
    expect(window.location.href).toContain('pay=1');
    expect(mockCreateRecord).not.toHaveBeenCalled();
  });

  it('Mode 2: successful checkout posts order and clears cart', async () => {
    mockCreateRecord.mockResolvedValue('internal-1');
    mockCreatePayment.mockResolvedValue({ success: true, status: 'completed' });
    render(<CartDrawer {...baseProps} />);
    fireEvent.click(screen.getByText('🔷 Checkout with Pi'));
    await waitFor(() => expect(screen.getByText('🎉 Payment successful! Redirecting…')).toBeDefined());
    expect(mockCreateRecord).toHaveBeenCalledWith(13, 'cart_checkout', 'TEC Cart — 3 items');
    expect(mockCreatePayment).toHaveBeenCalledWith(
      13, 'TEC Cart — 3 items',
      { source: 'cart', items: [{ productId: 'p1', qty: 2 }, { productId: 'p2', qty: 1 }] },
      'internal-1',
    );
    expect(global.fetch).toHaveBeenCalledWith('/api/bff/orders', expect.objectContaining({ method: 'POST' }));
    expect(baseProps.onClear).toHaveBeenCalled();
  });

  it('shows error when payment record creation fails', async () => {
    mockCreateRecord.mockResolvedValue(null);
    render(<CartDrawer {...baseProps} />);
    fireEvent.click(screen.getByText('🔷 Checkout with Pi'));
    await waitFor(() => expect(screen.getByText('Failed to initialize payment.')).toBeDefined());
    expect(mockCreatePayment).not.toHaveBeenCalled();
  });

  it('shows cancelled state and allows retry reset', async () => {
    mockCreateRecord.mockResolvedValue('internal-2');
    mockCreatePayment.mockResolvedValue({ success: false, status: 'cancelled' });
    render(<CartDrawer {...baseProps} />);
    fireEvent.click(screen.getByText('🔷 Checkout with Pi'));
    await waitFor(() => expect(screen.getByText('Payment cancelled')).toBeDefined());
    fireEvent.click(screen.getByText('Try again'));
    expect(screen.getByText('🔷 Checkout with Pi')).toBeDefined();
  });

  it('shows error message when createU2APayment throws', async () => {
    mockCreateRecord.mockResolvedValue('internal-3');
    mockCreatePayment.mockRejectedValue(new Error('Pi SDK error: denied'));
    render(<CartDrawer {...baseProps} />);
    fireEvent.click(screen.getByText('🔷 Checkout with Pi'));
    await waitFor(() => expect(screen.getByText('Pi SDK error: denied')).toBeDefined());
  });

  it('checkout no-op when cart empty', () => {
    render(<CartDrawer {...baseProps} items={[]} />);
    expect(screen.queryByText('🔷 Checkout with Pi')).toBeNull();
  });
});
