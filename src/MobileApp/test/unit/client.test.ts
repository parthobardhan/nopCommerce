import { ApiClient, ApiError } from '../../src/api/client';
import { ProductSorting } from '../../src/api/types';

function response(status: number, body?: unknown, raw?: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => raw ?? (body === undefined ? '' : JSON.stringify(body)),
  } as Response;
}

function setup(token: string | null = 'abc', onUnauthorized?: () => Promise<string | null>) {
  const fetchImpl = jest.fn(async (_url: string, _init?: RequestInit) => response(200, { ok: true }));
  const client = new ApiClient({ baseUrl: 'http://store', getToken: () => token, onUnauthorized, fetchImpl: fetchImpl as unknown as typeof fetch });
  return { client, fetchImpl };
}

describe('ApiClient', () => {
  it('sends the bearer token and JSON body to the mobile API prefix', async () => {
    const { client, fetchImpl } = setup();
    await client.login('a@b.com', 'secret');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://store/api/mobile/v1/auth/login');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer abc' });
    expect(JSON.parse(init?.body as string)).toEqual({ email: 'a@b.com', password: 'secret' });
  });

  it('omits the authorization header and body when not needed', async () => {
    const { client, fetchImpl } = setup(null);
    await client.createSession();

    const [, init] = fetchImpl.mock.calls[0];
    expect(init?.headers).toEqual({ Accept: 'application/json' });
    expect(init?.body).toBeUndefined();
  });

  const endpoints: { name: string; call: (client: ApiClient) => Promise<unknown>; method: string; path: string; body?: unknown }[] = [
    { name: 'getCustomer', call: (c) => c.getCustomer(), method: 'GET', path: '/customer' },
    { name: 'register', call: (c) => c.register({ email: 'e', password: 'p', firstName: 'f', lastName: 'l' }), method: 'POST', path: '/auth/register', body: { email: 'e', password: 'p', firstName: 'f', lastName: 'l' } },
    { name: 'logout', call: (c) => c.logout(), method: 'POST', path: '/auth/logout' },
    { name: 'getCategories', call: (c) => c.getCategories(), method: 'GET', path: '/categories' },
    { name: 'getCategoryProducts', call: (c) => c.getCategoryProducts(3), method: 'GET', path: '/categories/3/products?page=0&pageSize=20' },
    { name: 'getCategoryProducts sorted', call: (c) => c.getCategoryProducts(3, 2, ProductSorting.PriceAsc, 10), method: 'GET', path: '/categories/3/products?page=2&pageSize=10&orderBy=10' },
    { name: 'getFeaturedProducts', call: (c) => c.getFeaturedProducts(), method: 'GET', path: '/products/featured' },
    { name: 'searchProducts', call: (c) => c.searchProducts('htc one', 1), method: 'GET', path: '/products/search?q=htc%20one&page=1&pageSize=20' },
    { name: 'getProduct', call: (c) => c.getProduct(5), method: 'GET', path: '/products/5' },
    { name: 'getCart', call: (c) => c.getCart(), method: 'GET', path: '/cart' },
    { name: 'addToCart', call: (c) => c.addToCart(4, 2), method: 'POST', path: '/cart/items', body: { productId: 4, quantity: 2, attributes: [] } },
    { name: 'updateCartItem', call: (c) => c.updateCartItem(9, 3), method: 'PUT', path: '/cart/items/9', body: { quantity: 3 } },
    { name: 'removeCartItem', call: (c) => c.removeCartItem(9), method: 'DELETE', path: '/cart/items/9' },
    { name: 'getCountries', call: (c) => c.getCountries(), method: 'GET', path: '/countries' },
    { name: 'getStates', call: (c) => c.getStates(237), method: 'GET', path: '/countries/237/states' },
    { name: 'getCheckout', call: (c) => c.getCheckout(), method: 'GET', path: '/checkout' },
    { name: 'getShippingMethods', call: (c) => c.getShippingMethods(), method: 'GET', path: '/checkout/shipping-methods' },
    { name: 'selectShippingMethod', call: (c) => c.selectShippingMethod({ name: 'Ground', shippingRateComputationMethodSystemName: 'S' }), method: 'POST', path: '/checkout/shipping-method', body: { name: 'Ground', shippingRateComputationMethodSystemName: 'S' } },
    { name: 'getPaymentMethods', call: (c) => c.getPaymentMethods(), method: 'GET', path: '/checkout/payment-methods' },
    { name: 'selectPaymentMethod', call: (c) => c.selectPaymentMethod('Payments.CheckMoneyOrder'), method: 'POST', path: '/checkout/payment-method', body: { systemName: 'Payments.CheckMoneyOrder' } },
    { name: 'setCheckoutAttributes', call: (c) => c.setCheckoutAttributes([{ id: 1, valueIds: [2] }]), method: 'POST', path: '/checkout/attributes', body: { attributes: [{ id: 1, valueIds: [2] }] } },
    { name: 'confirmOrder', call: (c) => c.confirmOrder(), method: 'POST', path: '/checkout/confirm' },
    { name: 'getOrders', call: (c) => c.getOrders(), method: 'GET', path: '/orders' },
    { name: 'getOrder', call: (c) => c.getOrder(7), method: 'GET', path: '/orders/7' },
  ];

  it.each(endpoints)('$name calls $method $path', async ({ call, method, path, body }) => {
    const { client, fetchImpl } = setup();
    await call(client);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(init?.method).toBe(method);
    expect(url).toBe(`http://store/api/mobile/v1${path}`);
    if (body !== undefined) expect(JSON.parse(init?.body as string)).toEqual(body);
  });

  it('posts the address as the request body', async () => {
    const { client, fetchImpl } = setup();
    const address = { firstName: 'J', lastName: 'S', email: 'j@s.com', countryId: 1, stateProvinceId: null, city: 'c', address1: 'a', zipPostalCode: 'z', phoneNumber: 'p' };
    await client.setAddress(address);
    expect(JSON.parse(fetchImpl.mock.calls[0][1]?.body as string)).toEqual(address);
  });

  it('exposes the base url', () => {
    expect(setup().client.baseUrl).toBe('http://store');
  });

  it('returns operation results with errors instead of throwing', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValueOnce(response(400, { success: false, errors: ['Out of stock'] }));
    await expect(client.addToCart(1, 1)).resolves.toEqual({ success: false, errors: ['Out of stock'] });
  });

  it('throws ApiError with the server message for other failures', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValueOnce(response(404, { error: 'Product not found' }));
    const error = await client.getProduct(1).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Product not found');
    expect(error.status).toBe(404);
  });

  it('falls back to a generic message for empty error bodies', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValueOnce(response(500));
    await expect(client.getCart()).rejects.toThrow('Request failed (HTTP 500)');
  });

  it('reports unparsable responses', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValueOnce(response(200, undefined, '<html>'));
    await expect(client.getCart()).rejects.toThrow('Unexpected response from the store (HTTP 200)');
  });

  it('returns null for empty successful bodies', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValueOnce(response(204));
    await expect(client.logout()).resolves.toBeNull();
  });

  it('wraps network failures with status 0', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockRejectedValueOnce(new Error('Network request failed'));
    const error = await client.getCategories().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toContain('Network request failed');
  });

  it('retries once with a fresh token after 401', async () => {
    const onUnauthorized = jest.fn(async () => 'fresh');
    const { client, fetchImpl } = setup('stale', onUnauthorized);
    fetchImpl.mockResolvedValueOnce(response(401, { error: 'expired' })).mockResolvedValueOnce(response(200, { id: 1 }));

    await expect(client.getCustomer()).resolves.toEqual({ id: 1 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect((fetchImpl.mock.calls[1][1]?.headers as Record<string, string>).Authorization).toBe('Bearer fresh');
  });

  it('surfaces the 401 when no fresh token is available', async () => {
    const { client, fetchImpl } = setup('stale', async () => null);
    fetchImpl.mockResolvedValueOnce(response(401, { error: 'Unauthorized' }));
    await expect(client.getCustomer()).rejects.toMatchObject({ status: 401, message: 'Unauthorized' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('uses the global fetch when no implementation is given', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = jest.fn(async () => response(200, [])) as unknown as typeof fetch;
    try {
      const client = new ApiClient({ baseUrl: 'http://store', getToken: () => null });
      await expect(client.getCategories()).resolves.toEqual([]);
      expect(globalThis.fetch).toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
    }
  });
});
