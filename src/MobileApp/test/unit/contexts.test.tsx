import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';

import { CartProvider, useCart } from '../../src/context/CartContext';
import { SessionProvider, useApi, useSession } from '../../src/context/SessionContext';
import { createFakeApi, reply, type FakeApi } from '../fakeApi';
import { cart, cartItem, guestCustomer, registeredCustomer } from '../fixtures';

function wrapperFor(api: FakeApi) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <SessionProvider baseUrl="http://store" fetchImpl={api.fetch}>
        <CartProvider>{children}</CartProvider>
      </SessionProvider>
    );
  };
}

async function renderSession(api: FakeApi) {
  const hook = await renderHook(() => ({ session: useSession(), cart: useCart(), api: useApi() }), { wrapper: wrapperFor(api) });
  await waitFor(() => expect(hook.result.current.session.ready).toBe(true));
  return hook;
}

const session = (token: string, customer = guestCustomer) => ({ token, customer });

describe('SessionContext', () => {
  it('creates and stores a guest session on first launch', async () => {
    const api = createFakeApi();
    const { result } = await renderSession(api);

    expect(result.current.session.customer).toEqual(guestCustomer);
    expect(result.current.session.isRegistered).toBe(false);
    expect(await SecureStore.getItemAsync('nop_mobile_api_token')).toBe('guest-token');
    expect(result.current.api.baseUrl).toBe('http://store');
  });

  it('resumes a stored session', async () => {
    await SecureStore.setItemAsync('nop_mobile_api_token', 'stored');
    const api = createFakeApi({ 'GET /customer': registeredCustomer });
    const { result } = await renderSession(api);

    expect(api.calls('POST /session')).toHaveLength(0);
    expect(api.calls('GET /customer')[0].token).toBe('stored');
    expect(result.current.session.isRegistered).toBe(true);
  });

  it('starts a new guest session when the stored token is rejected', async () => {
    await SecureStore.setItemAsync('nop_mobile_api_token', 'revoked');
    const api = createFakeApi({
      'GET /customer': (request: { token: string | null }) => (request.token === 'revoked' ? reply(401, { error: 'Unauthorized' }) : guestCustomer),
    });
    const { result } = await renderSession(api);

    expect(result.current.session.customer).toEqual(guestCustomer);
    expect(await SecureStore.getItemAsync('nop_mobile_api_token')).toBe('guest-token');
  });

  it('exposes connection errors and retries', async () => {
    const api = createFakeApi({ 'POST /session': reply(500, { error: 'Store offline' }) });
    const { result } = await renderSession(api);
    expect(result.current.session.error).toBe('Store offline');

    api.set('POST /session', session('t2'));
    await act(async () => result.current.session.retry());
    await waitFor(() => expect(result.current.session.customer).toEqual(guestCustomer));
    expect(result.current.session.error).toBeNull();
  });

  it('logs in and switches to the returned token', async () => {
    const api = createFakeApi({ 'POST /auth/login': { success: true, errors: [], session: session('user-token', registeredCustomer) } });
    const { result } = await renderSession(api);

    let errors: string[] = [];
    await act(async () => {
      errors = await result.current.session.login('jane@example.com', 'secret');
    });
    expect(errors).toEqual([]);
    expect(result.current.session.isRegistered).toBe(true);
    expect(await SecureStore.getItemAsync('nop_mobile_api_token')).toBe('user-token');
  });

  it('returns login errors', async () => {
    const api = createFakeApi({ 'POST /auth/login': reply(400, { success: false, errors: ['Wrong password'], session: null }) });
    const { result } = await renderSession(api);
    await expect(result.current.session.login('a@b.co', 'x')).resolves.toEqual(['Wrong password']);

    api.set('POST /auth/login', reply(400, { success: false, errors: [], session: null }));
    await expect(result.current.session.login('a@b.co', 'x')).resolves.toEqual(['Login failed']);
  });

  it('registers the current guest', async () => {
    const api = createFakeApi({ 'POST /auth/register': { success: true, errors: [], session: session('user-token', registeredCustomer) } });
    const { result } = await renderSession(api);

    await act(async () => {
      await result.current.session.register({ email: 'jane@example.com', password: 'secret1', firstName: 'Jane', lastName: 'Doe' });
    });
    expect(api.calls('POST /auth/register')[0].body).toEqual({ email: 'jane@example.com', password: 'secret1', firstName: 'Jane', lastName: 'Doe' });
    expect(result.current.session.customer).toEqual(registeredCustomer);
  });

  it('handles registration errors and pending approval', async () => {
    const api = createFakeApi({ 'POST /auth/register': reply(400, { success: false, errors: [], session: null }) });
    const { result } = await renderSession(api);
    const data = { email: 'a@b.co', password: 'secret1', firstName: 'A', lastName: 'B' };
    await expect(result.current.session.register(data)).resolves.toEqual(['Registration failed']);

    api.set('POST /auth/register', { success: true, errors: ['Check your email to activate the account'], session: null });
    api.set('POST /session', session('next-guest'));
    let errors: string[] = [];
    await act(async () => {
      errors = await result.current.session.register(data);
    });
    expect(errors).toEqual(['Check your email to activate the account']);
    expect(await SecureStore.getItemAsync('nop_mobile_api_token')).toBe('next-guest');
  });

  it('logs out to a fresh guest session even if revoking fails', async () => {
    await SecureStore.setItemAsync('nop_mobile_api_token', 'user-token');
    const api = createFakeApi({ 'GET /customer': registeredCustomer, 'POST /auth/logout': reply(500, { error: 'oops' }) });
    const { result } = await renderSession(api);

    await act(async () => {
      await result.current.session.logout().catch(() => undefined);
    });
    expect(result.current.session.customer).toEqual(guestCustomer);
    expect(await SecureStore.getItemAsync('nop_mobile_api_token')).toBe('guest-token');
  });

  it('requires a provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(renderHook(() => useSession())).rejects.toThrow('useSession must be used within a SessionProvider');
    await expect(renderHook(() => useCart())).rejects.toThrow('useCart must be used within a CartProvider');
  });
});

describe('CartContext', () => {
  it('loads the cart for the session customer', async () => {
    const api = createFakeApi({ 'GET /cart': cart([cartItem(1, 2), cartItem(2, 1)]) });
    const { result } = await renderSession(api);
    await waitFor(() => expect(result.current.cart.itemCount).toBe(3));
  });

  it('adds, updates and removes items', async () => {
    const api = createFakeApi({
      'POST /cart/items': { success: true, errors: [], cart: cart([cartItem(1, 1)]) },
      'PUT /cart/items/:id': { success: true, errors: [], cart: cart([cartItem(1, 4)]) },
      'DELETE /cart/items/:id': { success: true, errors: [], cart: cart([]) },
    });
    const { result } = await renderSession(api);

    await act(async () => {
      await result.current.cart.addToCart(1, 1);
    });
    expect(api.calls('POST /cart/items')[0].body).toEqual({ productId: 1, quantity: 1, attributes: [] });
    expect(result.current.cart.itemCount).toBe(1);

    await act(async () => {
      await result.current.cart.updateQuantity(1, 4);
    });
    expect(result.current.cart.itemCount).toBe(4);

    await act(async () => {
      await result.current.cart.removeItem(1);
    });
    expect(result.current.cart.itemCount).toBe(0);
  });

  it('returns store errors and keeps the returned cart', async () => {
    const api = createFakeApi({ 'POST /cart/items': reply(400, { success: false, errors: ['Out of stock'], cart: cart([cartItem(5)]) }) });
    const { result } = await renderSession(api);

    let errors: string[] = [];
    await act(async () => {
      errors = await result.current.cart.addToCart(1, 1);
    });
    expect(errors).toEqual(['Out of stock']);
    expect(result.current.cart.cart?.items[0].id).toBe(5);
  });

  it('turns network failures into errors', async () => {
    const api = createFakeApi({ 'PUT /cart/items/:id': reply(500, { error: 'Server error' }) });
    const { result } = await renderSession(api);
    await expect(result.current.cart.updateQuantity(1, 2)).resolves.toEqual(['Server error']);
  });

  it('exposes load errors', async () => {
    const api = createFakeApi({ 'GET /cart': reply(500, { error: 'Cart unavailable' }) });
    const { result } = await renderSession(api);
    await waitFor(() => expect(result.current.cart.error).toBe('Cart unavailable'));
  });
});
