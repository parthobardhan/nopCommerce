import { ApiError } from '../../src/api/errors';
import { addressToForm, buildUrl, HttpStoreApi } from '../../src/api/httpStoreApi';
import { MemoryTokenStorage } from '../../src/api/tokenStorage';

type Call = { url: string; init: RequestInit };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function createFetch(handler: (call: Call, index: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchFn = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return handler(call, calls.length - 1);
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

const TOKEN = { token: 'jwt-guest', customer_id: 42, username: null, token_type: 'Bearer', expires_in: 3600, created_on_utc: '2026-01-01T00:00:00Z' };

describe('buildUrl', () => {
  it('joins base, prefix and path without duplicate slashes', () => {
    expect(buildUrl('https://shop.example.com/', '/Catalog/Search')).toBe('https://shop.example.com/api-frontend/Catalog/Search');
    expect(buildUrl('https://shop.example.com', 'Catalog/Search')).toBe('https://shop.example.com/api-frontend/Catalog/Search');
  });

  it('encodes query parameters and drops undefined ones', () => {
    expect(buildUrl('https://s.io', '/Catalog/Search', { q: 'nike shoes', pageNumber: 2, pageSize: undefined })).toBe(
      'https://s.io/api-frontend/Catalog/Search?q=nike%20shoes&pageNumber=2',
    );
  });
});

describe('addressToForm', () => {
  it('flattens populated fields with the given prefix', () => {
    expect(
      addressToForm('BillingNewAddress', {
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        company: '',
        country_id: 1,
        city: 'London',
        address1: '12 Analytical St',
        zip_postal_code: 'N1',
        phone_number: '+44 20 1234',
      }),
    ).toEqual({
      'BillingNewAddress.FirstName': 'Ada',
      'BillingNewAddress.LastName': 'Lovelace',
      'BillingNewAddress.Email': 'ada@example.com',
      'BillingNewAddress.CountryId': '1',
      'BillingNewAddress.City': 'London',
      'BillingNewAddress.Address1': '12 Analytical St',
      'BillingNewAddress.ZipPostalCode': 'N1',
      'BillingNewAddress.PhoneNumber': '+44 20 1234',
    });
  });
});

describe('HttpStoreApi', () => {
  it('bootstraps a guest token before the first authenticated call and sends it as a bearer', async () => {
    const { fetchFn, calls } = createFetch((call) => {
      if (call.url.endsWith('/Authenticate/GetToken')) return jsonResponse(TOKEN);
      return jsonResponse([]);
    });
    const storage = new MemoryTokenStorage();
    const api = new HttpStoreApi({ baseUrl: 'https://shop.example.com', tokenStorage: storage, fetchFn });

    await api.getHomepageProducts();

    expect(calls[0].url).toBe('https://shop.example.com/api-frontend/Authenticate/GetToken');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ guest: true });
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-guest');
    expect((await storage.get())?.token).toBe('jwt-guest');
  });

  it('reuses a stored token and requests it only once under concurrency', async () => {
    const { fetchFn, calls } = createFetch((call) => (call.url.endsWith('/Authenticate/GetToken') ? jsonResponse(TOKEN) : jsonResponse([])));
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: new MemoryTokenStorage(), fetchFn });

    await Promise.all([api.getHomepageProducts(), api.getHomepageCategories()]);

    expect(calls.filter((c) => c.url.endsWith('/Authenticate/GetToken'))).toHaveLength(1);
  });

  it('drops a rejected token, mints a guest token and retries once on 401', async () => {
    const { fetchFn, calls } = createFetch((call, index) => {
      if (call.url.endsWith('/Authenticate/GetToken')) return jsonResponse({ ...TOKEN, token: 'fresh' });
      return index === 0 ? jsonResponse({ message: 'expired' }, 401) : jsonResponse({ items: [], warnings: [], is_editable: true });
    });
    const storage = new MemoryTokenStorage();
    await storage.set({ token: 'stale', customer_id: 42, username: null });
    const onSessionExpired = jest.fn();
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: storage, fetchFn, onSessionExpired });

    const cart = await api.getCart();

    expect(cart.items).toEqual([]);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer stale');
    expect((calls[2].init.headers as Record<string, string>).Authorization).toBe('Bearer fresh');
    expect((await storage.get())?.token).toBe('fresh');
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('signals session expiry when a customer token is rejected so the UI drops to guest', async () => {
    const { fetchFn, calls } = createFetch((call, index) => {
      if (call.url.endsWith('/Authenticate/GetToken')) return jsonResponse({ ...TOKEN, token: 'guest-2', customer_id: 77 });
      return index === 0 ? jsonResponse({ message: 'expired' }, 401) : jsonResponse([]);
    });
    const storage = new MemoryTokenStorage();
    await storage.set({ token: 'customer-jwt', customer_id: 5, username: 'ada@example.com' });
    const onSessionExpired = jest.fn();
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: storage, fetchFn, onSessionExpired });

    await api.getHomepageProducts();

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledWith({ token: 'guest-2', customer_id: 77, username: null });
    expect(await storage.get()).toEqual({ token: 'guest-2', customer_id: 77, username: null });
    expect((calls[2].init.headers as Record<string, string>).Authorization).toBe('Bearer guest-2');
  });

  it('does not clobber a token another call already refreshed after a 401', async () => {
    const { fetchFn } = createFetch(() => jsonResponse({ message: 'expired' }, 401));
    const storage = new MemoryTokenStorage();
    await storage.set({ token: 'old', customer_id: 5, username: 'ada@example.com' });
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: storage, fetchFn });
    const original = fetchFn as jest.Mock;
    original.mockImplementationOnce(async () => {
      await storage.set({ token: 'newer', customer_id: 5, username: 'ada@example.com' });
      return jsonResponse({ message: 'expired' }, 401);
    });

    await expect(api.getHomepageProducts()).rejects.toMatchObject({ kind: 'unauthorized' });
    expect((await storage.get())?.token).toBe('newer');
  });

  it('maps HTTP failures to typed ApiErrors with server messages', async () => {
    const { fetchFn } = createFetch((call) => {
      if (call.url.endsWith('/Authenticate/GetToken')) return jsonResponse(TOKEN);
      return jsonResponse({ errors: ['Product not found'] }, 404);
    });
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: new MemoryTokenStorage(), fetchFn });

    await expect(api.getProductDetails(999)).rejects.toMatchObject({ kind: 'not_found', status: 404, message: 'Product not found' });
  });

  it('wraps network failures as ApiError(network)', async () => {
    const fetchFn = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: new MemoryTokenStorage(), fetchFn });

    const error = await api.getGuestToken().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('network');
  });

  it('rejects malformed payloads instead of leaking them into the UI', async () => {
    const { fetchFn } = createFetch((call) => (call.url.endsWith('/Authenticate/GetToken') ? jsonResponse(TOKEN) : jsonResponse({ unexpected: true })));
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: new MemoryTokenStorage(), fetchFn });

    await expect(api.getCart()).rejects.toMatchObject({ kind: 'malformed_response' });
  });

  it('sends login credentials to GetToken and stores the customer token', async () => {
    const { fetchFn, calls } = createFetch(() => jsonResponse({ ...TOKEN, token: 'jwt-customer', username: 'ada@example.com' }));
    const storage = new MemoryTokenStorage();
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: storage, fetchFn });

    const token = await api.login('ada@example.com', 's3cret', true);

    expect(JSON.parse(String(calls[0].init.body))).toEqual({ guest: false, username: 'ada@example.com', password: 's3cret', remember_me: true });
    expect(token.username).toBe('ada@example.com');
    expect(await storage.get()).toEqual({ token: 'jwt-customer', customer_id: 42, username: 'ada@example.com' });
  });

  it('restores a stored customer session on launch without minting a guest token', async () => {
    const { fetchFn, calls } = createFetch(() => jsonResponse(TOKEN));
    const storage = new MemoryTokenStorage();
    await storage.set({ token: 'jwt-customer', customer_id: 5, username: 'ada@example.com' });
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: storage, fetchFn });

    expect(await api.restoreSession()).toEqual({ token: 'jwt-customer', customer_id: 5, username: 'ada@example.com' });
    expect(calls).toHaveLength(0);
    expect((await storage.get())?.token).toBe('jwt-customer');
  });

  it('bootstraps a guest session on launch when nothing is stored', async () => {
    const { fetchFn } = createFetch(() => jsonResponse(TOKEN));
    const storage = new MemoryTokenStorage();
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: storage, fetchFn });

    expect(await api.restoreSession()).toEqual({ token: 'jwt-guest', customer_id: 42, username: null });
    expect((await storage.get())?.token).toBe('jwt-guest');
  });

  it('keeps a login that completes while the launch guest token is still in flight', async () => {
    let releaseGuest: (r: Response) => void = () => undefined;
    const { fetchFn } = createFetch((call) => {
      const body = JSON.parse(String(call.init.body));
      if (body.guest) return new Promise<Response>((resolve) => (releaseGuest = resolve));
      return jsonResponse({ ...TOKEN, token: 'jwt-customer', customer_id: 5, username: 'ada@example.com' });
    });
    const storage = new MemoryTokenStorage();
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: storage, fetchFn });

    const restoring = api.restoreSession();
    await api.login('ada@example.com', 's3cret', true);
    releaseGuest(jsonResponse(TOKEN));

    expect(await restoring).toMatchObject({ token: 'jwt-customer', username: 'ada@example.com' });
    expect((await storage.get())?.token).toBe('jwt-customer');
  });

  it('loads states for a country and drops the "Other" placeholder', async () => {
    const { fetchFn, calls } = createFetch((call) => {
      if (call.url.endsWith('/Authenticate/GetToken')) return jsonResponse(TOKEN);
      return call.url.includes('/Country/GetStatesByCountryId/1')
        ? jsonResponse([{ id: 40, name: 'California' }, { id: 41, name: 'New York' }])
        : jsonResponse([{ id: 0, name: 'Other' }]);
    });
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: new MemoryTokenStorage(), fetchFn });

    expect(await api.getStatesByCountry(1)).toEqual([
      { text: 'California', value: '40' },
      { text: 'New York', value: '41' },
    ]);
    expect(calls[1].url).toBe('https://s.io/api-frontend/Country/GetStatesByCountryId/1?addSelectStateItem=false');
    expect(await api.getStatesByCountry(3)).toEqual([]);
  });

  it('sends the selected state with the billing address', async () => {
    const { fetchFn, calls } = createFetch((call) => (call.url.endsWith('/Authenticate/GetToken') ? jsonResponse(TOKEN) : jsonResponse({ redirect_to_method: 'ShippingMethod' })));
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: new MemoryTokenStorage(), fetchFn });

    await api.saveBillingAddress({ first_name: 'A', last_name: 'B', email: 'a@b.co', country_id: 1, state_province_id: 41, city: 'NYC', address1: '1 St', zip_postal_code: '10001', phone_number: '5550100' }, true);

    expect(JSON.parse(String(calls[1].init.body))).toMatchObject({ 'BillingNewAddress.StateProvinceId': '41', ShipToSameAddress: 'true' });
  });

  it('offers only offline payment methods and refuses to save redirecting ones', async () => {
    const { fetchFn, calls } = createFetch((call) => {
      if (call.url.endsWith('/Authenticate/GetToken')) return jsonResponse(TOKEN);
      return jsonResponse({
        payment_methods: [
          { payment_method_system_name: 'Payments.PayPalCommerce', name: 'PayPal', description: null, fee: null, selected: true },
          { payment_method_system_name: 'Payments.Manual', name: 'Credit card', description: null, fee: null, selected: false },
          { payment_method_system_name: 'Payments.CheckMoneyOrder', name: 'Check / Money Order', description: null, fee: null, selected: false },
        ],
      });
    });
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: new MemoryTokenStorage(), fetchFn });

    const methods = await api.getPaymentMethods();
    expect(methods.payment_methods.map((m) => m.payment_method_system_name)).toEqual(['Payments.CheckMoneyOrder']);

    const before = calls.length;
    expect(await api.savePaymentMethod('Payments.PayPalCommerce')).toMatchObject({ errors: [expect.stringMatching(/not supported/)] });
    expect(calls).toHaveLength(before);
  });

  it('posts cart and checkout form dictionaries in the Web API shape', async () => {
    const { fetchFn, calls } = createFetch((call) => {
      if (call.url.endsWith('/Authenticate/GetToken')) return jsonResponse(TOKEN);
      if (call.url.includes('/ShoppingCart/')) return jsonResponse({ items: [], warnings: [], is_editable: true });
      return jsonResponse({ redirect_to_method: 'ShippingMethod' });
    });
    const api = new HttpStoreApi({ baseUrl: 'https://s.io', tokenStorage: new MemoryTokenStorage(), fetchFn });

    await api.addToCart(4, 2);
    await api.updateCartItemQuantity(7, 3);
    await api.removeCartItem(7);
    await api.saveShippingMethod('Ground___Shipping.FixedByWeightByTotal');
    await api.savePaymentMethod('Payments.CheckMoneyOrder');

    const bodies = calls.slice(1).map((c) => ({ url: c.url.replace('https://s.io/api-frontend', ''), body: c.init.body ? JSON.parse(String(c.init.body)) : undefined }));
    expect(bodies).toEqual([
      { url: '/ShoppingCart/AddProductToCartFromCatalog/4/1/2', body: {} },
      { url: '/ShoppingCart/UpdateCart', body: { itemquantity7: '3' } },
      { url: '/ShoppingCart/UpdateCart', body: { removefromcart: '7' } },
      { url: '/Checkout/SaveShippingMethod', body: { shippingoption: 'Ground___Shipping.FixedByWeightByTotal' } },
      { url: '/Checkout/SavePaymentMethod', body: { paymentmethod: 'Payments.CheckMoneyOrder' } },
    ]);
  });
});
