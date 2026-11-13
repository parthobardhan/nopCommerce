import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { StoreApiContext, type StoreApi } from '../../src/api';
import { DemoStoreApi } from '../../src/api/demo/demoStoreApi';
import { MemoryTokenStorage } from '../../src/api/tokenStorage';
import CheckoutScreen from '../../app/checkout/index';

const mockRouter = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    get router() {
      return mockRouter;
    },
    useLocalSearchParams: () => ({}),
    Link: ({ children, asChild, href: _href, ...props }: any) =>
      asChild ? React.cloneElement(children, props) : React.createElement(Text, props, children),
  };
});

const queryClients: QueryClient[] = [];
afterEach(() => {
  queryClients.splice(0).forEach((client) => client.clear());
});

function createWrapper(api: StoreApi) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  queryClients.push(queryClient);
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <StoreApiContext.Provider value={api}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StoreApiContext.Provider>
    );
  };
}

async function fillAddress() {
  await fireEvent.changeText(screen.getByTestId('addr-first-name'), 'Ada');
  await fireEvent.changeText(screen.getByTestId('addr-last-name'), 'Lovelace');
  await fireEvent.changeText(screen.getByTestId('addr-email'), 'ada@example.com');
  await fireEvent.changeText(screen.getByTestId('addr-address1'), '21 West 52nd Street');
  await fireEvent.changeText(screen.getByTestId('addr-city'), 'New York');
  await fireEvent.changeText(screen.getByTestId('addr-zip'), '10021');
  await fireEvent.changeText(screen.getByTestId('addr-phone'), '2125550100');
}

describe('CheckoutScreen address step', () => {
  it('requires a state for countries that have states and sends it to the store', async () => {
    const api = new DemoStoreApi({ tokenStorage: new MemoryTokenStorage(), latencyMs: 0 });
    await api.addToCart(4, 1);
    const save = jest.spyOn(api, 'saveBillingAddress');
    await render(<CheckoutScreen />, { wrapper: createWrapper(api) });

    await screen.findByTestId('addr-first-name');
    expect(screen.queryByText('Ship to this address')).toBeNull();
    await fillAddress();
    await fireEvent.press(screen.getByTestId('country-1'));
    await screen.findByTestId('state-41');

    await fireEvent.press(screen.getByTestId('address-continue'));
    expect(await screen.findByTestId('addr-state-error')).toHaveTextContent(/state/i);
    expect(save).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('state-41'));
    await fireEvent.press(screen.getByTestId('address-continue'));

    await screen.findByTestId('shipping-ground');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ country_id: 1, state_province_id: 41 }), true);
  });

  it('stops when the store asks for a separate shipping address', async () => {
    const api = new DemoStoreApi({ tokenStorage: new MemoryTokenStorage(), latencyMs: 0 });
    await api.addToCart(4, 1);
    jest.spyOn(api, 'saveBillingAddress').mockResolvedValue({ redirect_to_method: 'ShippingAddress', goto_section: 'shipping' });
    await render(<CheckoutScreen />, { wrapper: createWrapper(api) });

    await screen.findByTestId('addr-first-name');
    await fillAddress();
    await fireEvent.press(screen.getByTestId('country-3'));
    await waitFor(() => expect(screen.getByTestId('address-continue')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('address-continue'));

    expect(await screen.findByTestId('checkout-error')).toHaveTextContent(/separate shipping address/);
    expect(screen.getByTestId('checkout-address')).toBeTruthy();
  });
});
