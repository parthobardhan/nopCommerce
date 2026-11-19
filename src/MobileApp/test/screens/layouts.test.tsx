import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import TabsLayout from '../../src/app/(tabs)/_layout';
import RootLayout from '../../src/app/_layout';
import { CartProvider } from '../../src/context/CartContext';
import { SessionProvider } from '../../src/context/SessionContext';
import { createFakeApi, reply } from '../fakeApi';
import { cart, cartItem, guestCustomer } from '../fixtures';

jest.mock('../../src/config', () => ({ getApiUrl: () => 'http://store' }));

describe('RootLayout', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('connects to the store before declaring the routes', async () => {
    const api = createFakeApi();
    globalThis.fetch = api.fetch;
    await render(<RootLayout />);

    expect(await screen.findByTestId('route-(tabs)')).toBeOnTheScreen();
    expect(screen.getByText('Checkout')).toBeOnTheScreen();
    expect(screen.getByTestId('route-product/[id]')).toBeOnTheScreen();
    expect(api.calls('POST /session')).toHaveLength(1);
  });

  it('shows a retryable error when the store is unreachable', async () => {
    const api = createFakeApi({ 'POST /session': reply(503, { error: 'Service unavailable' }) });
    globalThis.fetch = api.fetch;
    await render(<RootLayout />);

    expect(await screen.findByText('Could not reach the store. Service unavailable')).toBeOnTheScreen();
    api.set('POST /session', { token: 'guest-token', customer: guestCustomer });
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByTestId('route-(tabs)')).toBeOnTheScreen();
  });
});

describe('TabsLayout', () => {
  it('declares the tabs with a cart badge', async () => {
    const api = createFakeApi({ 'GET /cart': cart([cartItem(1, 3)]) });
    await render(
      <SessionProvider baseUrl="http://store" fetchImpl={api.fetch}>
        <CartProvider>
          <TabsLayout />
        </CartProvider>
      </SessionProvider>,
    );

    expect(screen.getByText('Shop')).toBeOnTheScreen();
    expect(screen.getByText('Search')).toBeOnTheScreen();
    expect(screen.getByText('Account')).toBeOnTheScreen();
    expect(await screen.findByTestId('route-cart-badge')).toHaveTextContent('3');
  });
});
