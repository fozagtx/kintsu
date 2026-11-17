'use client';
import { useEffect, useState } from 'react';
import type { Cart } from './pricing';

const KEY = 'kintsu-cart';
const EMPTY: Cart = { qty: 0, coupon: null, wrap: false };

export function readCart(): Cart {
  try {
    return { ...EMPTY, ...JSON.parse(sessionStorage.getItem(KEY) ?? '{}') };
  } catch {
    return EMPTY;
  }
}

export function writeCart(cart: Cart) {
  sessionStorage.setItem(KEY, JSON.stringify(cart));
}

export function useCart(): [Cart, (next: Cart) => void, boolean] {
  const [cart, setCart] = useState<Cart>(EMPTY);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setCart(readCart());
    setReady(true);
  }, []);
  const update = (next: Cart) => {
    writeCart(next);
    setCart(next);
  };
  return [cart, update, ready];
}
