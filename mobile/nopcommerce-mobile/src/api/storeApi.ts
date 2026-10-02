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
  SearchModelDto,
  ShoppingCartModelDto,
  TokenResponse,
  RegisterRequest,
  RegisterResponse,
} from './types';

export interface CategoryQuery {
  pageNumber?: number;
  pageSize?: number;
  orderBy?: number;
}

/**
 * Everything the UI needs from a nopCommerce store. Implemented by
 * `HttpStoreApi` (real Web API Frontend plugin) and `DemoStoreApi` (fixtures).
 */
export interface StoreApi {
  readonly mode: 'live' | 'demo';

  // auth
  getGuestToken(): Promise<TokenResponse>;
  login(username: string, password: string, rememberMe: boolean): Promise<TokenResponse>;
  register(request: RegisterRequest): Promise<RegisterResponse>;
  getCustomerInfo(): Promise<CustomerInfoModelDto>;

  // catalog
  getHomepageCategories(): Promise<CategoryModelDto[]>;
  getCatalogRoot(): Promise<CategorySimpleModelDto[]>;
  getCategory(categoryId: number, query?: CategoryQuery): Promise<CategoryModelDto>;
  search(term: string, query?: CategoryQuery): Promise<SearchModelDto>;
  getHomepageProducts(): Promise<ProductOverviewModelDto[]>;
  getProductDetails(productId: number): Promise<ProductDetailsModelDto>;

  // cart
  addToCart(productId: number, quantity: number): Promise<AddProductToCartResponse>;
  getCart(): Promise<ShoppingCartModelDto>;
  getCartTotals(): Promise<OrderTotalsModelDto>;
  updateCartItemQuantity(itemId: number, quantity: number): Promise<ShoppingCartModelDto>;
  removeCartItem(itemId: number): Promise<ShoppingCartModelDto>;

  // checkout
  getBillingAddress(): Promise<CheckoutBillingAddressModelDto>;
  saveBillingAddress(address: AddressModelDto, shipToSameAddress: boolean): Promise<CheckoutRedirectResponse>;
  getShippingMethods(): Promise<CheckoutShippingMethodModelDto>;
  saveShippingMethod(option: string): Promise<CheckoutRedirectResponse>;
  getPaymentMethods(): Promise<CheckoutPaymentMethodModelDto>;
  savePaymentMethod(systemName: string): Promise<CheckoutRedirectResponse>;
  getConfirm(): Promise<CheckoutConfirmModelDto>;
  confirmOrder(): Promise<ConfirmOrderResponse>;

  // orders
  getCustomerOrders(): Promise<CustomerOrderListModelDto>;
  getOrderDetails(orderId: number): Promise<OrderDetailsModelDto>;
}

/** Persists the bearer token between launches. */
export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string | null): Promise<void>;
}

export const SHOPPING_CART_TYPE_ID = 1;
