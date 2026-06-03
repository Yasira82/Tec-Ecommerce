'use client';

import { useState, useEffect, useCallback } from 'react';

export interface CartProduct {
  id: string;
  title: string;
  price: number;
  images?: string[];
  image_url?: string;
  category?: string;
}

export interface CartItem {
  product: CartProduct;
  qty: number;
}

const STORAGE_KEY = 'tec_cart';

function load(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch { return []; }
}

function save(items: CartItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(load());
    setHydrated(true);
  }, []);

  const sync = useCallback((next: CartItem[]) => {
    setItems(next);
    save(next);
  }, []);

  const addToCart = useCallback((product: CartProduct) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      const next = existing
        ? prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { product, qty: 1 }];
      save(next);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.product.id !== productId);
      save(next);
      return next;
    });
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    setItems(prev => {
      const next = qty <= 0
        ? prev.filter(i => i.product.id !== productId)
        : prev.map(i => i.product.id === productId ? { ...i, qty } : i);
      save(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => sync([]), [sync]);

  const getTotal   = () => items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const itemCount  = items.reduce((s, i) => s + i.qty, 0);
  const isInCart   = (productId: string) => items.some(i => i.product.id === productId);

  return { items, hydrated, itemCount, addToCart, removeFromCart, updateQty, clearCart, getTotal, isInCart };
}
