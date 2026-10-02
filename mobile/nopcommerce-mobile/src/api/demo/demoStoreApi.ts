import { ApiError } from '../errors';
import type { CategoryQuery, StoreApi, TokenStorage } from '../storeApi';
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
  OrderDetailsModelDto,
  OrderTotalsModelDto,
  ProductDetailsModelDto,
  ProductOverviewModelDto,
  RegisterRequest,
  RegisterResponse,
  SearchModelDto,
  ShoppingCartItemModelDto,
  ShoppingCartModelDto,
  TokenResponse,
} from '../types';
import { formatMoney, round2, summarizeCart } from '../../domain/cart';
import { isAddressValid } from '../../domain/checkout';
import {
  DEMO_CATEGORY_SEEDS,
  DEMO_COUNTRIES,
  DEMO_CUSTOMER,
  DEMO_PAYMENT_METHODS,
  DEMO_PRODUCT_SEEDS,
  DEMO_SHIPPING_METHODS,
  slugify,
  toCategory,
  toDetails,
  toOverview,
} from './fixtures';

interface DemoCustomer extends CustomerInfoModelDto {
  password: string;
}

interface DemoOrder extends OrderDetailsModelDto {
  customerEmail: string | null;
}

interface DemoState {
  customer: DemoCustomer | null;
  cart: ShoppingCartItemModelDto[];
  nextCartItemId: number;
  billing: AddressModelDto | null;
  shippingOption: string | null;
  paymentMethod: string | null;
  orders: DemoOrder[];
  nextOrderId: number;
  registered: DemoCustomer[];
}

export interface DemoStoreApiOptions {
  tokenStorage: TokenStorage;
  /** Simulated latency so loading states are visible; 0 in tests. */
  latencyMs?: number;
  now?: () => Date;
}

/**
 * Fully in-memory nopCommerce store. State lives for the app session only;
 * it exists so the UI can be exercised without a reachable Web API.
 */
export class DemoStoreApi implements StoreApi {
  readonly mode = 'demo' as const;
  private readonly tokenStorage: TokenStorage;
  private readonly latencyMs: number;
  private readonly now: () => Date;
  private state: DemoState;

  constructor(options: DemoStoreApiOptions) {
    this.tokenStorage = options.tokenStorage;
    this.latencyMs = options.latencyMs ?? 250;
    this.now = options.now ?? (() => new Date());
    this.state = initialState();
  }

  // ---- auth -------------------------------------------------------------

  async getGuestToken(): Promise<TokenResponse> {
    await this.delay();
    this.state.customer = null;
    const token = this.token(0, null);
    await this.tokenStorage.set(token.token);
    return token;
  }

  async login(username: string, password: string, _rememberMe: boolean): Promise<TokenResponse> {
    await this.delay();
    const email = username.trim().toLowerCase();
    const match = this.state.registered.find((c) => c.email.toLowerCase() === email && c.password === password);
    if (!match) throw new ApiError('validation', 'Login was unsuccessful. Please correct the errors and try again.', { status: 400, details: ['The credentials provided are incorrect'] });
    this.state.customer = match;
    const token = this.token(1 + this.state.registered.indexOf(match), match.email);
    await this.tokenStorage.set(token.token);
    return token;
  }

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    await this.delay();
    const errors: string[] = [];
    const email = request.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('Wrong email');
    if (request.password.length < 6) errors.push('Password must meet the following rules: must have at least 6 characters');
    if (request.password !== request.confirm_password) errors.push('The password and confirmation password do not match.');
    if (!request.first_name.trim()) errors.push('First name is required.');
    if (!request.last_name.trim()) errors.push('Last name is required.');
    if (this.state.registered.some((c) => c.email.toLowerCase() === email.toLowerCase())) errors.push('The specified email already exists');
    if (errors.length) return { success: false, errors };
    const customer: DemoCustomer = { email, first_name: request.first_name.trim(), last_name: request.last_name.trim(), password: request.password, username: email };
    this.state.registered.push(customer);
    this.state.customer = customer;
    const token = this.token(this.state.registered.length, email);
    await this.tokenStorage.set(token.token);
    return { success: true, token };
  }

  async getCustomerInfo(): Promise<CustomerInfoModelDto> {
    await this.delay();
    const customer = this.state.customer;
    if (!customer) throw new ApiError('unauthorized', 'Sign in to view your account', { status: 401 });
    return { email: customer.email, username: customer.username, first_name: customer.first_name, last_name: customer.last_name };
  }

  // ---- catalog ----------------------------------------------------------

  async getHomepageCategories(): Promise<CategoryModelDto[]> {
    await this.delay();
    return DEMO_CATEGORY_SEEDS.filter((c) => c.homepage).map((c) => toCategory(c, this.productsIn(c.id), 1, 0));
  }

  async getCatalogRoot(): Promise<CategorySimpleModelDto[]> {
    await this.delay();
    const simple = (parentId: number | null): CategorySimpleModelDto[] =>
      DEMO_CATEGORY_SEEDS.filter((c) => c.parentId === parentId).map((c) => ({
        id: c.id,
        name: c.name,
        se_name: slugify(c.name),
        number_of_products: this.productsIn(c.id).length,
        include_in_top_menu: true,
        sub_categories: simple(c.id),
      }));
    return simple(null);
  }

  async getCategory(categoryId: number, query: CategoryQuery = {}): Promise<CategoryModelDto> {
    await this.delay();
    const seed = DEMO_CATEGORY_SEEDS.find((c) => c.id === categoryId);
    if (!seed) throw new ApiError('not_found', 'Category not found', { status: 404 });
    return toCategory(seed, this.productsIn(categoryId), query.pageNumber ?? 1, query.pageSize ?? 20);
  }

  async search(term: string, query: CategoryQuery = {}): Promise<SearchModelDto> {
    await this.delay();
    const needle = term.trim().toLowerCase();
    const products = needle.length < 2 ? [] : DEMO_PRODUCT_SEEDS.filter((p) => `${p.name} ${p.short} ${p.sku}`.toLowerCase().includes(needle)).map(toOverview);
    const pageSize = query.pageSize ?? 20;
    const pageNumber = query.pageNumber ?? 1;
    return {
      q: term,
      catalog_products_model: {
        products: products.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
        total_items: products.length,
        total_pages: Math.max(1, Math.ceil(products.length / pageSize)),
        page_index: pageNumber - 1,
        page_number: pageNumber,
        page_size: pageSize,
        no_results: products.length === 0,
      },
    };
  }

  async getHomepageProducts(): Promise<ProductOverviewModelDto[]> {
    await this.delay();
    return DEMO_PRODUCT_SEEDS.filter((p) => p.homepage).map(toOverview);
  }

  async getProductDetails(productId: number): Promise<ProductDetailsModelDto> {
    await this.delay();
    const seed = DEMO_PRODUCT_SEEDS.find((p) => p.id === productId);
    if (!seed) throw new ApiError('not_found', 'Product not found', { status: 404 });
    return toDetails(seed);
  }

  // ---- cart -------------------------------------------------------------

  async addToCart(productId: number, quantity: number): Promise<AddProductToCartResponse> {
    await this.delay();
    const seed = DEMO_PRODUCT_SEEDS.find((p) => p.id === productId);
    if (!seed) return { success: false, errors: ['Product not found'] };
    if (!Number.isInteger(quantity) || quantity < 1) return { success: false, errors: ['Quantity should be positive'] };
    const existing = this.state.cart.find((i) => i.product_id === productId);
    const newQty = (existing?.quantity ?? 0) + quantity;
    if (newQty > seed.stock) return { success: false, errors: [`The maximum quantity allowed for purchase is ${seed.stock}.`] };
    if (existing) {
      Object.assign(existing, this.line(seed, newQty, existing.id));
    } else {
      this.state.cart.push(this.line(seed, newQty, this.state.nextCartItemId++));
    }
    return { success: true, message: 'The product has been added to your shopping cart' };
  }

  async getCart(): Promise<ShoppingCartModelDto> {
    await this.delay();
    return this.cartModel();
  }

  async getCartTotals(): Promise<OrderTotalsModelDto> {
    await this.delay();
    return this.totals();
  }

  async updateCartItemQuantity(itemId: number, quantity: number): Promise<ShoppingCartModelDto> {
    await this.delay();
    const item = this.state.cart.find((i) => i.id === itemId);
    if (!item) throw new ApiError('not_found', 'Cart item not found', { status: 404 });
    if (quantity <= 0) return this.removeCartItem(itemId);
    const seed = DEMO_PRODUCT_SEEDS.find((p) => p.id === item.product_id)!;
    if (quantity > seed.stock) {
      item.warnings = [`The maximum quantity allowed for purchase is ${seed.stock}.`];
      return this.cartModel();
    }
    Object.assign(item, this.line(seed, quantity, item.id));
    return this.cartModel();
  }

  async removeCartItem(itemId: number): Promise<ShoppingCartModelDto> {
    await this.delay();
    this.state.cart = this.state.cart.filter((i) => i.id !== itemId);
    return this.cartModel();
  }

  // ---- checkout ---------------------------------------------------------

  async getBillingAddress(): Promise<CheckoutBillingAddressModelDto> {
    await this.delay();
    this.requireCart();
    const customer = this.state.customer;
    const previous = this.state.orders.find((o) => o.customerEmail && o.customerEmail === customer?.email)?.billing_address;
    const fresh: AddressModelDto = {
      first_name: customer?.first_name ?? '',
      last_name: customer?.last_name ?? '',
      email: customer?.email ?? '',
      company: '',
      country_id: null,
      state_province_id: null,
      city: '',
      address1: '',
      address2: '',
      zip_postal_code: '',
      phone_number: '',
      available_countries: DEMO_COUNTRIES,
    };
    return {
      existing_addresses: previous ? [{ ...previous, id: 1 }] : [],
      billing_new_address: this.state.billing ? { ...this.state.billing, available_countries: DEMO_COUNTRIES } : fresh,
      ship_to_same_address: true,
      ship_to_same_address_allowed: true,
    };
  }

  async saveBillingAddress(address: AddressModelDto, _shipToSameAddress: boolean): Promise<CheckoutRedirectResponse> {
    await this.delay();
    this.requireCart();
    if (!isAddressValid(address)) return { wrong_billing_address: true, errors: ['Please fill in all required address fields'] };
    const country = DEMO_COUNTRIES.find((c) => Number(c.value) === address.country_id);
    this.state.billing = { ...address, country_name: country?.text ?? null, available_countries: undefined };
    return { redirect_to_method: 'ShippingMethod', goto_section: 'shipping_method' };
  }

  async getShippingMethods(): Promise<CheckoutShippingMethodModelDto> {
    await this.delay();
    this.requireCart();
    return {
      shipping_methods: DEMO_SHIPPING_METHODS.map((m) => ({ ...m, selected: this.state.shippingOption ? this.shippingKey(m.name) === this.state.shippingOption : m.selected })),
      warnings: [],
    };
  }

  async saveShippingMethod(option: string): Promise<CheckoutRedirectResponse> {
    await this.delay();
    this.requireCart();
    const known = DEMO_SHIPPING_METHODS.some((m) => this.shippingKey(m.name) === option);
    if (!known) return { errors: ['Selected shipping method cannot be loaded'] };
    this.state.shippingOption = option;
    return { redirect_to_method: 'PaymentMethod', goto_section: 'payment_method' };
  }

  async getPaymentMethods(): Promise<CheckoutPaymentMethodModelDto> {
    await this.delay();
    this.requireCart();
    return { payment_methods: DEMO_PAYMENT_METHODS.map((m) => ({ ...m, selected: (this.state.paymentMethod ?? DEMO_PAYMENT_METHODS[0].payment_method_system_name) === m.payment_method_system_name })) };
  }

  async savePaymentMethod(systemName: string): Promise<CheckoutRedirectResponse> {
    await this.delay();
    this.requireCart();
    if (!DEMO_PAYMENT_METHODS.some((m) => m.payment_method_system_name === systemName)) return { errors: ['Selected payment method cannot be parsed'] };
    this.state.paymentMethod = systemName;
    return { redirect_to_method: 'Confirm', goto_section: 'confirm_order' };
  }

  async getConfirm(): Promise<CheckoutConfirmModelDto> {
    await this.delay();
    this.requireCart();
    const warnings: string[] = [];
    if (!this.state.billing) warnings.push('Billing address is required');
    if (!this.state.shippingOption) warnings.push('Shipping method is required');
    return { terms_of_service_on_order_confirm_page: false, min_order_total_warning: null, warnings };
  }

  async confirmOrder(): Promise<ConfirmOrderResponse> {
    await this.delay();
    this.requireCart();
    const errors: string[] = [];
    if (!this.state.billing) errors.push('Billing address is required');
    if (!this.state.shippingOption) errors.push('Shipping method is required');
    const payment = this.state.paymentMethod ?? DEMO_PAYMENT_METHODS[0].payment_method_system_name;
    if (errors.length) return { errors };

    const totals = this.totals();
    const id = this.state.nextOrderId++;
    const shippingName = DEMO_SHIPPING_METHODS.find((m) => this.shippingKey(m.name) === this.state.shippingOption)?.name ?? null;
    const order: DemoOrder = {
      id,
      custom_order_number: String(id),
      created_on: this.now().toISOString(),
      order_status: 'Pending',
      payment_method: DEMO_PAYMENT_METHODS.find((m) => m.payment_method_system_name === payment)?.name ?? payment,
      payment_method_status: 'Pending',
      shipping_method: shippingName,
      shipping_status: 'Not yet shipped',
      items: this.state.cart.map((i) => ({
        id: i.id,
        sku: i.sku,
        product_id: i.product_id,
        product_name: i.product_name,
        product_se_name: i.product_se_name,
        unit_price: i.unit_price,
        sub_total: i.sub_total,
        quantity: i.quantity,
        attribute_info: i.attribute_info,
        picture: i.picture,
      })),
      order_subtotal: totals.sub_total ?? formatMoney(0),
      order_shipping: totals.shipping,
      tax: totals.tax,
      order_total: totals.order_total ?? formatMoney(0),
      billing_address: this.state.billing!,
      shipping_address: this.state.billing,
      customerEmail: this.state.customer?.email ?? null,
    };
    this.state.orders.unshift(order);
    this.state.cart = [];
    this.state.shippingOption = null;
    this.state.paymentMethod = null;
    return { completed: { order_id: id, custom_order_number: order.custom_order_number, on_page_completed: true } };
  }

  // ---- orders -----------------------------------------------------------

  async getCustomerOrders(): Promise<CustomerOrderListModelDto> {
    await this.delay();
    const email = this.state.customer?.email ?? null;
    return {
      orders: this.state.orders
        .filter((o) => o.customerEmail === email)
        .map((o) => ({
          id: o.id,
          custom_order_number: o.custom_order_number,
          order_total: o.order_total,
          order_status: o.order_status,
          payment_status: o.payment_method_status ?? 'Pending',
          shipping_status: o.shipping_status ?? 'Not yet shipped',
          created_on: o.created_on,
        })),
    };
  }

  async getOrderDetails(orderId: number): Promise<OrderDetailsModelDto> {
    await this.delay();
    const email = this.state.customer?.email ?? null;
    const order = this.state.orders.find((o) => o.id === orderId && o.customerEmail === email);
    if (!order) throw new ApiError('not_found', 'Order not found', { status: 404 });
    const { customerEmail: _ignored, ...details } = order;
    return details;
  }

  // ---- helpers ----------------------------------------------------------

  private productsIn(categoryId: number): ProductOverviewModelDto[] {
    const ids = new Set<number>([categoryId, ...DEMO_CATEGORY_SEEDS.filter((c) => c.parentId === categoryId).map((c) => c.id)]);
    return DEMO_PRODUCT_SEEDS.filter((p) => ids.has(p.categoryId)).map(toOverview);
  }

  private line(seed: (typeof DEMO_PRODUCT_SEEDS)[number], quantity: number, id: number): ShoppingCartItemModelDto {
    const overview = toOverview(seed);
    return {
      id,
      sku: seed.sku,
      picture: overview.picture_models[0] ?? null,
      product_id: seed.id,
      product_name: seed.name,
      product_se_name: overview.se_name,
      unit_price: formatMoney(seed.price),
      unit_price_value: seed.price,
      sub_total: formatMoney(round2(seed.price * quantity)),
      sub_total_value: round2(seed.price * quantity),
      quantity,
      allowed_quantities: [],
      attribute_info: null,
      warnings: [],
    };
  }

  private cartModel(): ShoppingCartModelDto {
    return { items: this.state.cart.map((i) => ({ ...i })), warnings: [], is_editable: true };
  }

  private totals(): OrderTotalsModelDto {
    const { subtotalValue } = summarizeCart(this.state.cart);
    return {
      sub_total: formatMoney(subtotalValue),
      shipping: this.state.cart.length ? formatMoney(0) : null,
      requires_shipping: true,
      tax: formatMoney(0),
      order_total: formatMoney(subtotalValue),
      order_total_value: subtotalValue,
    };
  }

  private requireCart(): void {
    if (!this.state.cart.length) throw new ApiError('validation', 'Your shopping cart is empty', { status: 400 });
  }

  private shippingKey(name: string): string {
    return `${name}___Shipping.FixedByWeightByTotal`;
  }

  private token(customerId: number, username: string | null): TokenResponse {
    return {
      token: `demo.${customerId}.${this.now().getTime().toString(36)}`,
      customer_id: customerId,
      username,
      token_type: 'Bearer',
      expires_in: 60 * 60 * 24 * 30,
      created_on_utc: this.now().toISOString(),
    };
  }

  private delay(): Promise<void> {
    return this.latencyMs ? new Promise((resolve) => setTimeout(resolve, this.latencyMs)) : Promise.resolve();
  }
}

function initialState(): DemoState {
  return {
    customer: null,
    cart: [],
    nextCartItemId: 1,
    billing: null,
    shippingOption: null,
    paymentMethod: null,
    orders: [],
    nextOrderId: 1001,
    registered: [{ ...DEMO_CUSTOMER, username: DEMO_CUSTOMER.email }],
  };
}
