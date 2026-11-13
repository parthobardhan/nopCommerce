import { isOfflinePaymentMethod } from '../domain/checkout';
import { ApiError } from './errors';
import { SHOPPING_CART_TYPE_ID, toStoredSession, type CategoryQuery, type StoreApi, type StoredSession, type TokenStorage } from './storeApi';
import type {
  AddProductToCartResponse,
  AddressModelDto,
  CategoryModelDto,
  CategorySimpleModelDto,
  CheckoutBillingAddressModelDto,
  CheckoutConfirmModelDto,
  CheckoutPaymentMethodModelDto,
  CheckoutRedirectResponse,
  CheckoutShippingMethodModelDto,
  ConfirmOrderResponse,
  CustomerInfoModelDto,
  CustomerOrderListModelDto,
  FormDictionary,
  OrderDetailsModelDto,
  OrderTotalsModelDto,
  ProductDetailsModelDto,
  ProductOverviewModelDto,
  RegisterRequest,
  RegisterResponse,
  SearchModelDto,
  SelectListItemDto,
  ShoppingCartModelDto,
  TokenRequest,
  TokenResponse,
} from './types';
import {
  assertCart,
  assertCatalogProducts,
  assertCategory,
  assertCategoryList,
  assertProductDetails,
  assertProductList,
  assertSimpleCategoryList,
  assertToken,
  isRecord,
} from './validation';

export const API_PREFIX = '/api-frontend';

export interface HttpStoreApiOptions {
  baseUrl: string;
  tokenStorage: TokenStorage;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Called when the store rejects a customer token and the client falls back to a guest session. */
  onSessionExpired?: (guest: StoredSession) => void;
}

/** Joins a store base URL and an API path without duplicate or missing slashes. */
export function buildUrl(baseUrl: string, path: string, query?: Record<string, string | number | undefined>): string {
  const base = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${API_PREFIX}${cleanPath}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `${url}?${params.join('&')}` : url;
}

/** Flattens an address into the `Prefix.Field` form keys the Save* endpoints expect. */
export function addressToForm(prefix: string, address: AddressModelDto): FormDictionary {
  const entries: [string, string | number | null | undefined][] = [
    ['FirstName', address.first_name],
    ['LastName', address.last_name],
    ['Email', address.email],
    ['Company', address.company],
    ['CountryId', address.country_id],
    ['StateProvinceId', address.state_province_id],
    ['City', address.city],
    ['Address1', address.address1],
    ['Address2', address.address2],
    ['ZipPostalCode', address.zip_postal_code],
    ['PhoneNumber', address.phone_number],
  ];
  const form: FormDictionary = {};
  for (const [key, value] of entries) {
    if (value !== null && value !== undefined && value !== '') form[`${prefix}.${key}`] = String(value);
  }
  return form;
}

export class HttpStoreApi implements StoreApi {
  readonly mode = 'live' as const;
  private readonly baseUrl: string;
  private readonly tokenStorage: TokenStorage;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly onSessionExpired?: (guest: StoredSession) => void;
  private bootstrapPromise: Promise<StoredSession> | null = null;
  /** Bumped on every explicit sign-in/out so an in-flight guest bootstrap cannot overwrite it. */
  private authEpoch = 0;
  private latestSession: StoredSession | null = null;

  constructor(options: HttpStoreApiOptions) {
    this.baseUrl = options.baseUrl;
    this.tokenStorage = options.tokenStorage;
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.onSessionExpired = options.onSessionExpired;
  }

  // ---- auth -------------------------------------------------------------

  async restoreSession(): Promise<StoredSession> {
    return (await this.tokenStorage.get()) ?? this.bootstrapGuest();
  }

  async getGuestToken(): Promise<TokenResponse> {
    const token = await this.requestToken({ guest: true });
    await this.storeSession(token);
    return token;
  }

  async login(username: string, password: string, rememberMe: boolean): Promise<TokenResponse> {
    const token = await this.requestToken({ guest: false, username, password, remember_me: rememberMe });
    await this.storeSession(token);
    return token;
  }

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    const body = await this.request('POST', '/Customer/Register', { body: request });
    if (!isRecord(body)) return { success: true };
    const response = body as unknown as RegisterResponse;
    if (response.token?.token) await this.storeSession(response.token);
    return { success: response.success ?? !(response.errors?.length), errors: response.errors ?? null, token: response.token ?? null };
  }

  getCustomerInfo(): Promise<CustomerInfoModelDto> {
    return this.request('GET', '/Customer/Info') as Promise<CustomerInfoModelDto>;
  }

  // ---- catalog ----------------------------------------------------------

  async getHomepageCategories(): Promise<CategoryModelDto[]> {
    return assertCategoryList(await this.request('GET', '/Catalog/HomepageCategories'));
  }

  async getCatalogRoot(): Promise<CategorySimpleModelDto[]> {
    return assertSimpleCategoryList(await this.request('GET', '/Catalog/GetCatalogRoot'));
  }

  async getCategory(categoryId: number, query: CategoryQuery = {}): Promise<CategoryModelDto> {
    return assertCategory(
      await this.request('GET', `/Catalog/GetCategory/${categoryId}`, {
        query: { pageNumber: query.pageNumber, pageSize: query.pageSize, orderBy: query.orderBy },
      }),
    );
  }

  async search(term: string, query: CategoryQuery = {}): Promise<SearchModelDto> {
    const body = await this.request('GET', '/Catalog/Search', {
      query: { q: term, pageNumber: query.pageNumber, pageSize: query.pageSize },
    });
    if (!isRecord(body)) throw new ApiError('malformed_response', 'Search response is not an object');
    return { q: term, catalog_products_model: assertCatalogProducts(body.catalog_products_model) };
  }

  async getHomepageProducts(): Promise<ProductOverviewModelDto[]> {
    return assertProductList(await this.request('GET', '/Product/HomepageProducts'));
  }

  async getProductDetails(productId: number): Promise<ProductDetailsModelDto> {
    return assertProductDetails(
      await this.request('GET', `/Product/GetProductDetails/${productId}`, { query: { updateCartItemId: 0 } }),
    );
  }

  // ---- cart -------------------------------------------------------------

  async addToCart(productId: number, quantity: number): Promise<AddProductToCartResponse> {
    const body = await this.request(
      'POST',
      `/ShoppingCart/AddProductToCartFromCatalog/${productId}/${SHOPPING_CART_TYPE_ID}/${quantity}`,
      { body: {} },
    );
    if (!isRecord(body)) return { success: true };
    const errors = Array.isArray(body.errors) ? (body.errors as string[]) : null;
    return { success: body.success !== false && !(errors?.length), message: (body.message as string) ?? null, errors };
  }

  async getCart(): Promise<ShoppingCartModelDto> {
    return assertCart(await this.request('GET', '/ShoppingCart/Cart'));
  }

  getCartTotals(): Promise<OrderTotalsModelDto> {
    return this.request('GET', '/ShoppingCart/CartTotal') as Promise<OrderTotalsModelDto>;
  }

  async updateCartItemQuantity(itemId: number, quantity: number): Promise<ShoppingCartModelDto> {
    return assertCart(await this.request('POST', '/ShoppingCart/UpdateCart', { body: { [`itemquantity${itemId}`]: String(quantity) } }));
  }

  async removeCartItem(itemId: number): Promise<ShoppingCartModelDto> {
    return assertCart(await this.request('POST', '/ShoppingCart/UpdateCart', { body: { removefromcart: String(itemId) } }));
  }

  // ---- checkout ---------------------------------------------------------

  getBillingAddress(): Promise<CheckoutBillingAddressModelDto> {
    return this.request('GET', '/Checkout/BillingAddress') as Promise<CheckoutBillingAddressModelDto>;
  }

  async getStatesByCountry(countryId: number): Promise<SelectListItemDto[]> {
    const body = await this.request('GET', `/Country/GetStatesByCountryId/${countryId}`, { query: { addSelectStateItem: 'false' } });
    if (!Array.isArray(body)) throw new ApiError('malformed_response', 'States response is not a list');
    // nopCommerce answers a single id 0 "Other" entry for countries without states.
    return body
      .filter((s): s is { id: number; name: string } => isRecord(s) && typeof s.id === 'number' && s.id > 0 && typeof s.name === 'string')
      .map((s) => ({ text: s.name, value: String(s.id) }));
  }

  saveBillingAddress(address: AddressModelDto, shipToSameAddress: boolean): Promise<CheckoutRedirectResponse> {
    const form = addressToForm('BillingNewAddress', address);
    form.ShipToSameAddress = shipToSameAddress ? 'true' : 'false';
    return this.request('POST', '/Checkout/SaveBilling', { body: form }) as Promise<CheckoutRedirectResponse>;
  }

  getShippingMethods(): Promise<CheckoutShippingMethodModelDto> {
    return this.request('GET', '/Checkout/ShippingMethod') as Promise<CheckoutShippingMethodModelDto>;
  }

  saveShippingMethod(option: string): Promise<CheckoutRedirectResponse> {
    return this.request('POST', '/Checkout/SaveShippingMethod', { body: { shippingoption: option } }) as Promise<CheckoutRedirectResponse>;
  }

  async getPaymentMethods(): Promise<CheckoutPaymentMethodModelDto> {
    const model = (await this.request('GET', '/Checkout/PaymentMethod')) as CheckoutPaymentMethodModelDto;
    return { ...model, payment_methods: (model?.payment_methods ?? []).filter((m) => isOfflinePaymentMethod(m.payment_method_system_name)) };
  }

  async savePaymentMethod(systemName: string): Promise<CheckoutRedirectResponse> {
    if (!isOfflinePaymentMethod(systemName)) return { errors: ['This payment method is not supported in the app'] };
    return this.request('POST', '/Checkout/SavePaymentMethod', { body: { paymentmethod: systemName } }) as Promise<CheckoutRedirectResponse>;
  }

  getConfirm(): Promise<CheckoutConfirmModelDto> {
    return this.request('GET', '/Checkout/Confirm') as Promise<CheckoutConfirmModelDto>;
  }

  confirmOrder(): Promise<ConfirmOrderResponse> {
    return this.request('POST', '/Checkout/ConfirmOrder', { body: {} }) as Promise<ConfirmOrderResponse>;
  }

  // ---- orders -----------------------------------------------------------

  getCustomerOrders(): Promise<CustomerOrderListModelDto> {
    return this.request('GET', '/Order/CustomerOrders') as Promise<CustomerOrderListModelDto>;
  }

  getOrderDetails(orderId: number): Promise<OrderDetailsModelDto> {
    return this.request('GET', `/Order/Details/${orderId}`) as Promise<OrderDetailsModelDto>;
  }

  // ---- plumbing ---------------------------------------------------------

  private async requestToken(request: TokenRequest): Promise<TokenResponse> {
    const body = await this.request('POST', '/Authenticate/GetToken', { body: request, auth: false });
    return assertToken(body);
  }

  private async storeSession(token: TokenResponse): Promise<void> {
    this.authEpoch += 1;
    this.latestSession = toStoredSession(token);
    await this.tokenStorage.set(this.latestSession);
  }

  /** Mints a guest token unless a sign-in/out lands while the request is in flight. */
  private bootstrapGuest(): Promise<StoredSession> {
    if (!this.bootstrapPromise) {
      const epoch = this.authEpoch;
      this.bootstrapPromise = (async () => {
        const token = await this.requestToken({ guest: true });
        if (this.authEpoch !== epoch && this.latestSession) return this.latestSession;
        await this.storeSession(token);
        return toStoredSession(token);
      })().finally(() => {
        this.bootstrapPromise = null;
      });
    }
    return this.bootstrapPromise;
  }

  private async ensureToken(): Promise<string> {
    const stored = await this.tokenStorage.get();
    return stored ? stored.token : (await this.bootstrapGuest()).token;
  }

  private async request(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    options: { body?: unknown; query?: Record<string, string | number | undefined>; auth?: boolean; retry?: boolean } = {},
  ): Promise<unknown> {
    const { body, query, auth = true, retry = true } = options;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const sentToken = auth ? await this.ensureToken() : null;
    if (sentToken) headers.Authorization = `Bearer ${sentToken}`;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
    let response: Response;
    try {
      response = await this.fetchFn(buildUrl(this.baseUrl, path, query), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError' ? 'The store did not respond in time' : 'Could not reach the store';
      throw new ApiError('network', message);
    } finally {
      if (timer) clearTimeout(timer);
    }

    const parsed = await parseBody(response);
    if (response.status === 401 && sentToken && retry) {
      // Token expired or was revoked: drop it (unless a concurrent call already
      // replaced it), fall back to a guest token and retry once.
      const current = await this.tokenStorage.get();
      if (current?.token === sentToken) {
        await this.tokenStorage.set(null);
        if (current.username) {
          const guest = await this.bootstrapGuest();
          if (!guest.username) this.onSessionExpired?.(guest);
        }
      }
      return this.request(method, path, { ...options, retry: false });
    }
    if (!response.ok) throw ApiError.fromStatus(response.status, parsed);
    return parsed;
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
