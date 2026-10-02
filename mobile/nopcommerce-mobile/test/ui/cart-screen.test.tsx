import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { StoreApiContext } from '../../src/api';
import { DemoStoreApi } from '../../src/api/demo/demoStoreApi';
import { MemoryTokenStorage } from '../../src/api/tokenStorage';
import CartScreen from '../../app/(tabs)/cart';
import ProductScreen from '../../app/product/[id]';

const mockRouter = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockRouteParams: Record<string, string> = {};

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    get router() {
      return mockRouter;
    },
    useLocalSearchParams: () => mockRouteParams,
    Link: ({ children, asChild, href: _href, ...props }: any) =>
      asChild ? React.cloneElement(children, props) : React.createElement(Text, props, children),
    Stack: { Screen: () => null },
  };
});

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: any) => <View testID="image" {...props} /> };
});

const queryClients: QueryClient[] = [];
afterEach(() => {
  queryClients.splice(0).forEach((client) => client.clear());
});

function createWrapper(api: DemoStoreApi) {
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

function createApi() {
  return new DemoStoreApi({ tokenStorage: new MemoryTokenStorage(), latencyMs: 0 });
}

describe('CartScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
  });

  it('shows the empty state and routes home from it', async () => {
    await render(<CartScreen />, { wrapper: createWrapper(createApi()) });
    expect(await screen.findByText('Your cart is empty')).toBeTruthy();
    await fireEvent.press(screen.getByText('Start shopping'));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/');
  });

  it('lists items with totals, updates quantity and removes lines', async () => {
    const api = createApi();
    await api.addToCart(4, 1);
    await api.addToCart(28, 2);
    await render(<CartScreen />, { wrapper: createWrapper(api) });

    expect(await screen.findByText('Apple MacBook Pro')).toBeTruthy();
    expect(screen.getByText('Nike Floral Roshe Customized Running Shoes')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('total-total')).toHaveTextContent('$1,880.00'));

    await fireEvent.press(screen.getByTestId('qty-1-plus'));
    await waitFor(() => expect(screen.getByTestId('total-total')).toHaveTextContent('$3,680.00'));

    await fireEvent.press(screen.getByTestId('remove-2'));
    await waitFor(() => expect(screen.queryByText('Nike Floral Roshe Customized Running Shoes')).toBeNull());
    await waitFor(() => expect(screen.getByTestId('total-total')).toHaveTextContent('$3,600.00'));

    await fireEvent.press(screen.getByTestId('checkout-button'));
    expect(mockRouter.push).toHaveBeenCalledWith('/checkout');
  });
});

describe('ProductScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { id: '4' };
  });

  it('renders details and adds the chosen quantity to the cart', async () => {
    const api = createApi();
    await render(<ProductScreen />, { wrapper: createWrapper(api) });

    expect(await screen.findByTestId('product-name')).toHaveTextContent('Apple MacBook Pro');
    expect(screen.getByTestId('product-price')).toHaveTextContent('$1,800.00');

    await fireEvent.press(screen.getByTestId('product-qty-plus'));
    await fireEvent.press(screen.getByTestId('add-to-cart'));

    expect(await screen.findByTestId('add-feedback')).toHaveTextContent(/added to your shopping cart/i);
    const cart = await api.getCart();
    expect(cart.items).toEqual([expect.objectContaining({ product_id: 4, quantity: 2 })]);

    await fireEvent.press(screen.getByTestId('view-cart'));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/cart');
  });

  it('clamps typed quantities to stock and surfaces store errors from add to cart', async () => {
    const api = createApi();
    await api.addToCart(4, 2); // MacBook Pro fixture has 3 in stock
    await render(<ProductScreen />, { wrapper: createWrapper(api) });
    await screen.findByTestId('product-name');

    await fireEvent.changeText(screen.getByTestId('product-qty-input'), '50');
    expect(screen.getByTestId('product-qty-input').props.value).toBe('3');
    await fireEvent.press(screen.getByTestId('add-to-cart'));

    expect(await screen.findByTestId('add-feedback')).toHaveTextContent(/maximum quantity/);
    expect((await api.getCart()).items[0].quantity).toBe(2);
  });

  it('shows a not-found state for an invalid id', async () => {
    mockRouteParams = { id: 'abc' };
    await render(<ProductScreen />, { wrapper: createWrapper(createApi()) });
    expect(screen.getByText('Product not found')).toBeTruthy();
  });
});
