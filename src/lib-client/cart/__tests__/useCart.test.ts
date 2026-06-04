import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach }  from 'vitest';
import { useCart, CartProduct }              from '../useCart';

const p1: CartProduct = { id: 'p1', title: 'Product 1', price: 5 };
const p2: CartProduct = { id: 'p2', title: 'Product 2', price: 10 };

describe('useCart', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty', () => {
    const { result } = renderHook(() => useCart());
    expect(result.current.items).toEqual([]);
    expect(result.current.itemCount).toBe(0);
  });

  it('addToCart adds new item with qty 1', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].product.id).toBe('p1');
    expect(result.current.items[0].qty).toBe(1);
  });

  it('addToCart increments qty for existing item', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    act(() => result.current.addToCart(p1));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].qty).toBe(2);
  });

  it('addToCart keeps separate items for different products', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    act(() => result.current.addToCart(p2));
    expect(result.current.items).toHaveLength(2);
  });

  it('removeFromCart removes an item', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    act(() => result.current.removeFromCart('p1'));
    expect(result.current.items).toHaveLength(0);
  });

  it('removeFromCart ignores unknown id', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    act(() => result.current.removeFromCart('unknown'));
    expect(result.current.items).toHaveLength(1);
  });

  it('updateQty sets quantity', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    act(() => result.current.updateQty('p1', 5));
    expect(result.current.items[0].qty).toBe(5);
  });

  it('updateQty with qty 0 removes item', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    act(() => result.current.updateQty('p1', 0));
    expect(result.current.items).toHaveLength(0);
  });

  it('updateQty with negative qty removes item', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    act(() => result.current.updateQty('p1', -1));
    expect(result.current.items).toHaveLength(0);
  });

  it('clearCart removes all items', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    act(() => result.current.addToCart(p2));
    act(() => result.current.clearCart());
    expect(result.current.items).toHaveLength(0);
    expect(result.current.itemCount).toBe(0);
  });

  it('getTotal calculates price × qty for all items', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1)); // 5
    act(() => result.current.addToCart(p1)); // qty → 2, total 10
    act(() => result.current.addToCart(p2)); // 10
    expect(result.current.getTotal()).toBe(20);
  });

  it('getTotal returns 0 for empty cart', () => {
    const { result } = renderHook(() => useCart());
    expect(result.current.getTotal()).toBe(0);
  });

  it('itemCount sums all quantities', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    act(() => result.current.addToCart(p1));
    act(() => result.current.addToCart(p2));
    expect(result.current.itemCount).toBe(3);
  });

  it('isInCart returns true for added product', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    expect(result.current.isInCart('p1')).toBe(true);
  });

  it('isInCart returns false for product not in cart', () => {
    const { result } = renderHook(() => useCart());
    expect(result.current.isInCart('p1')).toBe(false);
  });

  it('isInCart returns false after removal', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    act(() => result.current.removeFromCart('p1'));
    expect(result.current.isInCart('p1')).toBe(false);
  });

  it('persists cart to localStorage on add', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    const stored = JSON.parse(localStorage.getItem('tec_cart') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].product.id).toBe('p1');
    expect(stored[0].qty).toBe(1);
  });

  it('clears localStorage on clearCart', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(p1));
    act(() => result.current.clearCart());
    const stored = JSON.parse(localStorage.getItem('tec_cart') ?? '[]');
    expect(stored).toHaveLength(0);
  });
});
