/**
 * DTOs mirroring the nopCommerce Web API Frontend plugin (snake_case JSON).
 * Only the fields the app consumes are typed; unknown fields are preserved by
 * the runtime guards but not modelled.
 */

export interface TokenResponse {
  token: string;
  customer_id: number;
  username: string | null;
  token_type: string;
  expires_in: number;
  created_on_utc: string;
}

export interface GuestTokenRequest {
  guest: true;
}

export interface CustomerTokenRequest {
  guest: false;
  username: string;
  password: string;
  remember_me: boolean;
}

export type TokenRequest = GuestTokenRequest | CustomerTokenRequest;

export interface PictureModelDto {
  image_url: string;
  thumb_image_url?: string | null;
  full_size_image_url?: string | null;
  title?: string | null;
  alternate_text?: string | null;
}

export interface ProductPriceModelDto {
  price: string | null;
  price_value: number;
  old_price?: string | null;
  old_price_value?: number | null;
  base_price_pangv?: string | null;
  disable_buy_button?: boolean;
  call_for_price?: boolean;
}

export interface ProductOverviewModelDto {
  id: number;
  name: string;
  short_description: string | null;
  full_description?: string | null;
  se_name: string;
  sku: string | null;
  mark_as_new?: boolean;
  product_price: ProductPriceModelDto;
  picture_models: PictureModelDto[];
}

export interface CatalogProductsModelDto {
  products: ProductOverviewModelDto[];
  total_items: number;
  total_pages: number;
  page_index: number;
  page_number: number;
  page_size: number;
  no_results?: boolean;
}

export interface CategorySimpleModelDto {
  id: number;
  name: string;
  se_name: string;
  number_of_products: number | null;
  include_in_top_menu?: boolean;
  sub_categories: CategorySimpleModelDto[];
}

export interface CategoryModelDto {
  id: number;
  name: string;
  description: string | null;
  se_name: string;
  picture_model: PictureModelDto | null;
  sub_categories: CategoryModelDto[];
  catalog_products_model: CatalogProductsModelDto;
}

export interface SearchModelDto {
  q: string;
  catalog_products_model: CatalogProductsModelDto;
}

export interface AddToCartModelDto {
  product_id: number;
  enter_quantity: number;
  minimum_quantity: number;
  maximum_quantity: number;
  allowed_quantities: { text: string; value: string }[];
  disable_buy_button: boolean;
  available_for_pre_order?: boolean;
}

export interface ProductDetailsModelDto {
  id: number;
  name: string;
  short_description: string | null;
  full_description: string | null;
  se_name: string;
  sku: string | null;
  stock_availability: string | null;
  default_picture_model: PictureModelDto;
  picture_models: PictureModelDto[];
  product_price: {
    current_price: string | null;
    price_value: number;
    old_price?: string | null;
    old_price_value?: number | null;
    call_for_price?: boolean;
  };
  add_to_cart: AddToCartModelDto;
  breadcrumb?: {
    category_breadcrumb: { id: number; name: string; se_name: string }[];
  } | null;
}

export interface AddProductToCartResponse {
  success: boolean;
  message?: string | null;
  errors?: string[] | null;
}

export interface ShoppingCartItemModelDto {
  id: number;
  sku: string | null;
  picture: PictureModelDto | null;
  product_id: number;
  product_name: string;
  product_se_name: string;
  unit_price: string;
  unit_price_value: number;
  sub_total: string;
  sub_total_value: number;
  quantity: number;
  allowed_quantities?: { text: string; value: string }[];
  attribute_info?: string | null;
  warnings: string[];
}

export interface ShoppingCartModelDto {
  items: ShoppingCartItemModelDto[];
  warnings: string[];
  is_editable: boolean;
}

export interface OrderTotalsModelDto {
  sub_total: string | null;
  sub_total_discount?: string | null;
  shipping: string | null;
  requires_shipping: boolean;
  tax: string | null;
  order_total: string | null;
  order_total_value?: number | null;
}

/** Form-dictionary body used by cart/checkout "Save*" endpoints. */
export type FormDictionary = Record<string, string>;

export interface SelectListItemDto {
  text: string;
  value: string;
  selected?: boolean;
}

export interface AddressModelDto {
  id?: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company?: string | null;
  country_id: number | null;
  country_name?: string | null;
  state_province_id?: number | null;
  state_province_name?: string | null;
  city: string | null;
  address1: string | null;
  address2?: string | null;
  zip_postal_code: string | null;
  phone_number: string | null;
  available_countries?: SelectListItemDto[];
}

export interface CheckoutBillingAddressModelDto {
  existing_addresses: AddressModelDto[];
  billing_new_address: AddressModelDto;
  ship_to_same_address: boolean;
  ship_to_same_address_allowed: boolean;
}

export interface CheckoutRedirectResponse {
  redirect_to_method?: string | null;
  wrong_billing_address?: boolean;
  goto_section?: string | null;
  errors?: string[] | null;
}

export interface ShippingMethodDto {
  name: string;
  description: string | null;
  fee: string;
  shipping_rate_computation_method_system_name: string;
  selected: boolean;
}

export interface CheckoutShippingMethodModelDto {
  shipping_methods: ShippingMethodDto[];
  warnings: string[];
}

export interface PaymentMethodDto {
  payment_method_system_name: string;
  name: string;
  description: string | null;
  fee: string | null;
  selected: boolean;
  logo_url?: string | null;
}

export interface CheckoutPaymentMethodModelDto {
  payment_methods: PaymentMethodDto[];
  display_reward_points?: boolean;
}

export interface CheckoutConfirmModelDto {
  terms_of_service_on_order_confirm_page: boolean;
  min_order_total_warning: string | null;
  warnings: string[];
}

export interface ConfirmOrderResponse {
  redirect_to_method?: string | null;
  completed?: {
    order_id: number;
    custom_order_number: string;
    on_page_completed?: boolean;
  } | null;
  errors?: string[] | null;
}

export interface CustomerInfoModelDto {
  email: string;
  username?: string | null;
  first_name: string | null;
  last_name: string | null;
  phone?: string | null;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirm_password: string;
  first_name: string;
  last_name: string;
}

export interface RegisterResponse {
  success: boolean;
  errors?: string[] | null;
  token?: TokenResponse | null;
}

export interface CustomerOrderDto {
  id: number;
  custom_order_number: string;
  order_total: string;
  order_status: string;
  payment_status: string;
  shipping_status: string;
  created_on: string;
}

export interface CustomerOrderListModelDto {
  orders: CustomerOrderDto[];
}

export interface OrderItemDto {
  id: number;
  sku: string | null;
  product_id: number;
  product_name: string;
  product_se_name?: string | null;
  unit_price: string;
  sub_total: string;
  quantity: number;
  attribute_info?: string | null;
  picture?: PictureModelDto | null;
}

export interface OrderDetailsModelDto {
  id: number;
  custom_order_number: string;
  created_on: string;
  order_status: string;
  payment_method: string | null;
  payment_method_status?: string | null;
  shipping_method: string | null;
  shipping_status?: string | null;
  items: OrderItemDto[];
  order_subtotal: string;
  order_shipping: string | null;
  tax: string | null;
  order_total: string;
  billing_address: AddressModelDto;
  shipping_address?: AddressModelDto | null;
}
