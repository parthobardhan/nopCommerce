// Mirrors the DTOs of the Misc.MobileApi nopCommerce plugin (src/Plugins/Nop.Plugin.Misc.MobileApi/Models)

export interface Category {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  parentCategoryId: number;
  subCategories: Category[];
}

export interface Price {
  value: number;
  formatted: string | null;
  oldValue: number | null;
  oldFormatted: string | null;
  callForPrice: boolean;
}

export interface ProductSummary {
  id: number;
  name: string;
  shortDescription: string | null;
  imageUrl: string | null;
  price: Price;
  ratingSum: number;
  reviewCount: number;
}

export interface PagedResult<T> {
  items: T[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
}

export type AttributeControlType =
  | 'dropdown'
  | 'radio'
  | 'checkboxes'
  | 'color'
  | 'image'
  | 'text'
  | 'multiline'
  | 'unsupported';

export interface AttributeValue {
  id: number;
  name: string;
  priceAdjustment: string | null;
  isPreSelected: boolean;
  colorSquaresRgb: string | null;
}

export interface Attribute {
  id: number;
  name: string;
  textPrompt: string | null;
  isRequired: boolean;
  controlType: AttributeControlType;
  values: AttributeValue[];
}

export interface ProductDetails {
  id: number;
  name: string;
  shortDescription: string | null;
  fullDescription: string | null;
  sku: string | null;
  imageUrls: string[];
  price: Price;
  inStock: boolean;
  stockAvailability: string | null;
  canAddToCart: boolean;
  cannotAddToCartReason: string | null;
  orderMinimumQuantity: number;
  orderMaximumQuantity: number;
  attributes: Attribute[];
  ratingSum: number;
  reviewCount: number;
}

export interface SelectedAttribute {
  id: number;
  valueIds: number[];
  text?: string;
}

export interface CartItem {
  id: number;
  productId: number;
  productName: string;
  imageUrl: string | null;
  attributeInfo: string | null;
  quantity: number;
  unitPrice: string;
  subTotal: string;
  subTotalValue: number;
  warnings: string[];
}

export interface CartTotals {
  subTotal: string;
  subTotalValue: number;
  subTotalDiscount: string | null;
  shipping: string | null;
  requiresShipping: boolean;
  paymentMethodFee: string | null;
  tax: string | null;
  orderTotalDiscount: string | null;
  total: string | null;
  totalValue: number | null;
}

export interface Cart {
  items: CartItem[];
  totalQuantity: number;
  totals: CartTotals;
  warnings: string[];
}

export interface CartOperationResult {
  success: boolean;
  errors: string[];
  cart: Cart;
}

export interface Customer {
  id: number;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isGuest: boolean;
}

export interface Session {
  token: string;
  customer: Customer;
}

export interface AuthResult {
  success: boolean;
  errors: string[];
  session: Session | null;
}

export interface Country {
  id: number;
  name: string;
  twoLetterIsoCode: string;
}

export interface StateProvince {
  id: number;
  name: string;
  abbreviation: string | null;
}

export interface Address {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  company?: string | null;
  countryId: number | null;
  countryName?: string | null;
  stateProvinceId: number | null;
  stateProvinceName?: string | null;
  city: string;
  address1: string;
  address2?: string | null;
  zipPostalCode: string;
  phoneNumber: string;
}

export interface ShippingMethod {
  name: string;
  description: string | null;
  shippingRateComputationMethodSystemName: string;
  fee: string;
  selected: boolean;
}

export interface PaymentMethod {
  systemName: string;
  name: string;
  description: string | null;
  fee: string | null;
  selected: boolean;
}

export interface CheckoutState {
  requiresShipping: boolean;
  checkoutAttributes: Attribute[];
  billingAddress: Address | null;
  shippingAddress: Address | null;
  selectedShippingMethod: ShippingMethod | null;
  warnings: string[];
  selectedPaymentMethod: PaymentMethod | null;
  cart: Cart;
  canConfirm: boolean;
}

export interface CheckoutResult {
  success: boolean;
  errors: string[];
  state: CheckoutState;
}

export interface PlaceOrderResult {
  success: boolean;
  errors: string[];
  orderId: number;
  customOrderNumber: string | null;
}

export interface OrderSummary {
  id: number;
  customOrderNumber: string;
  createdOnUtc: string;
  orderStatus: string;
  paymentStatus: string;
  shippingStatus: string;
  orderTotal: string;
}

export interface OrderItem {
  productId: number;
  productName: string | null;
  attributeInfo: string | null;
  quantity: number;
  unitPrice: string;
  subTotal: string;
}

export interface OrderDetails extends OrderSummary {
  paymentMethod: string | null;
  shippingMethod: string | null;
  subTotal: string;
  shipping: string;
  tax: string;
  billingAddress: Address | null;
  shippingAddress: Address | null;
  items: OrderItem[];
}

/** nopCommerce ProductSortingEnum values */
export enum ProductSorting {
  Position = 0,
  NameAsc = 5,
  NameDesc = 6,
  PriceAsc = 10,
  PriceDesc = 11,
  CreatedOn = 15,
}
