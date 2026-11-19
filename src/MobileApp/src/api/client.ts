import type {
  Address,
  AuthResult,
  Cart,
  CartOperationResult,
  Category,
  CheckoutResult,
  CheckoutState,
  Country,
  Customer,
  OrderDetails,
  OrderSummary,
  PagedResult,
  PaymentMethod,
  PlaceOrderResult,
  ProductDetails,
  ProductSorting,
  ProductSummary,
  SelectedAttribute,
  Session,
  ShippingMethod,
  StateProvince,
} from './types';

export const API_PREFIX = '/api/mobile/v1';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  /** Called on 401; should return a fresh token (or null) so the request can be retried once */
  onUnauthorized?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Thin typed wrapper over the Misc.MobileApi endpoints.
 * Operation endpoints (cart, checkout, auth) answer 400 with a result body carrying `errors`; those bodies are
 * returned to the caller instead of being thrown so screens can show the store's validation messages.
 */
export class ApiClient {
  private readonly options: ApiClientOptions;

  constructor(options: ApiClientOptions) {
    this.options = options;
  }

  get baseUrl(): string {
    return this.options.baseUrl;
  }

  private async send(method: Method, path: string, body: unknown, token: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const fetchImpl = this.options.fetchImpl ?? fetch;
    return fetchImpl(`${this.options.baseUrl}${API_PREFIX}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.send(method, path, body, this.options.getToken());
      if (response.status === 401 && this.options.onUnauthorized) {
        const token = await this.options.onUnauthorized();
        if (token) response = await this.send(method, path, body, token);
      }
    } catch (error) {
      throw new ApiError(`Cannot reach the store (${(error as Error).message})`, 0);
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(`Unexpected response from the store (HTTP ${response.status})`, response.status);
      }
    }

    if (response.ok) return data as T;

    if (data && typeof data === 'object' && Array.isArray((data as { errors?: unknown }).errors)) return data as T;

    const message = (data as { error?: string } | null)?.error ?? `Request failed (HTTP ${response.status})`;
    throw new ApiError(message, response.status);
  }

  // session & customer
  createSession = () => this.request<Session>('POST', '/session');
  getCustomer = () => this.request<Customer>('GET', '/customer');
  login = (email: string, password: string) => this.request<AuthResult>('POST', '/auth/login', { email, password });
  register = (data: { email: string; password: string; firstName: string; lastName: string }) =>
    this.request<AuthResult>('POST', '/auth/register', data);
  logout = () => this.request<{ success: boolean }>('POST', '/auth/logout');

  // catalog
  getCategories = () => this.request<Category[]>('GET', '/categories');
  getCategoryProducts = (categoryId: number, page = 0, orderBy?: ProductSorting, pageSize = 20) =>
    this.request<PagedResult<ProductSummary>>(
      'GET',
      `/categories/${categoryId}/products?page=${page}&pageSize=${pageSize}${orderBy !== undefined ? `&orderBy=${orderBy}` : ''}`,
    );
  getFeaturedProducts = () => this.request<ProductSummary[]>('GET', '/products/featured');
  searchProducts = (query: string, page = 0, pageSize = 20) =>
    this.request<PagedResult<ProductSummary>>('GET', `/products/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`);
  getProduct = (id: number) => this.request<ProductDetails>('GET', `/products/${id}`);

  // cart
  getCart = () => this.request<Cart>('GET', '/cart');
  addToCart = (productId: number, quantity: number, attributes: SelectedAttribute[] = []) =>
    this.request<CartOperationResult>('POST', '/cart/items', { productId, quantity, attributes });
  updateCartItem = (itemId: number, quantity: number) => this.request<CartOperationResult>('PUT', `/cart/items/${itemId}`, { quantity });
  removeCartItem = (itemId: number) => this.request<CartOperationResult>('DELETE', `/cart/items/${itemId}`);

  // checkout
  getCountries = () => this.request<Country[]>('GET', '/countries');
  getStates = (countryId: number) => this.request<StateProvince[]>('GET', `/countries/${countryId}/states`);
  getCheckout = () => this.request<CheckoutState>('GET', '/checkout');
  setAddress = (address: Address) => this.request<CheckoutResult>('POST', '/checkout/address', address);
  getShippingMethods = () => this.request<{ methods: ShippingMethod[]; errors: string[] }>('GET', '/checkout/shipping-methods');
  selectShippingMethod = (method: Pick<ShippingMethod, 'name' | 'shippingRateComputationMethodSystemName'>) =>
    this.request<CheckoutResult>('POST', '/checkout/shipping-method', method);
  getPaymentMethods = () => this.request<PaymentMethod[]>('GET', '/checkout/payment-methods');
  selectPaymentMethod = (systemName: string) => this.request<CheckoutResult>('POST', '/checkout/payment-method', { systemName });
  setCheckoutAttributes = (attributes: SelectedAttribute[]) => this.request<CheckoutResult>('POST', '/checkout/attributes', { attributes });
  confirmOrder = () => this.request<PlaceOrderResult>('POST', '/checkout/confirm');

  // orders
  getOrders = () => this.request<OrderSummary[]>('GET', '/orders');
  getOrder = (id: number) => this.request<OrderDetails>('GET', `/orders/${id}`);
}
