import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { CartProvider } from '../src/context/CartContext';
import { SessionProvider, useSession } from '../src/context/SessionContext';
import { createFakeApi, type Routes } from './fakeApi';

/** Mirrors the root layout: screens only mount once the session is established */
function Ready({ children }: { children: React.ReactNode }) {
  const { ready, customer } = useSession();
  return ready && customer ? <>{children}</> : null;
}

/** Render a screen inside the real session and cart providers, backed by a fake store API */
export async function renderWithStore(ui: React.ReactElement, routes: Routes = {}) {
  const api = createFakeApi(routes);
  const result = await render(
    <SessionProvider baseUrl="http://store" fetchImpl={api.fetch}>
      <CartProvider>
        <Ready>{ui}</Ready>
      </CartProvider>
    </SessionProvider>,
  );
  return { ...result, api, screen };
}

export { router, setParams } from './expoRouterMock';
