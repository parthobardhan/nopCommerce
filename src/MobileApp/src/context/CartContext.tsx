import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Cart, CartOperationResult, SelectedAttribute } from '../api/types';
import { useSession } from './SessionContext';

export interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  itemCount: number;
  refresh: () => Promise<void>;
  /** @returns errors from the store; empty on success */
  addToCart: (productId: number, quantity: number, attributes?: SelectedAttribute[]) => Promise<string[]>;
  updateQuantity: (itemId: number, quantity: number) => Promise<string[]>;
  removeItem: (itemId: number) => Promise<string[]>;
  setCart: (cart: Cart) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { api, customer, ready } = useSession();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCart(await api.getCart());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const customerId = customer?.id;
  useEffect(() => {
    // the cart belongs to the session customer, so reload it whenever that customer changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ready && customerId) refresh();
  }, [ready, customerId, refresh]);

  const run = useCallback(async (operation: () => Promise<CartOperationResult>) => {
    try {
      const result = await operation();
      if (result.cart) setCart(result.cart);
      return result.success ? [] : result.errors;
    } catch (e) {
      return [(e as Error).message];
    }
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      error,
      itemCount: cart?.totalQuantity ?? 0,
      refresh,
      addToCart: (productId, quantity, attributes = []) => run(() => api.addToCart(productId, quantity, attributes)),
      updateQuantity: (itemId, quantity) => run(() => api.updateCartItem(itemId, quantity)),
      removeItem: (itemId) => run(() => api.removeCartItem(itemId)),
      setCart,
    }),
    [api, cart, loading, error, refresh, run],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used within a CartProvider');
  return value;
}
