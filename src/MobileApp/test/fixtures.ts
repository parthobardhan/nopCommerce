import type {
  Address,
  Attribute,
  Cart,
  CartItem,
  Category,
  CheckoutState,
  Customer,
  OrderDetails,
  PagedResult,
  Price,
  ProductDetails,
  ProductSummary,
} from '../src/api/types';

export const guestCustomer: Customer = { id: 10, email: null, firstName: null, lastName: null, isGuest: true };
export const registeredCustomer: Customer = { id: 10, email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe', isGuest: false };

export const price = (value: number, extra: Partial<Price> = {}): Price => ({
  value,
  formatted: `$${value.toFixed(2)}`,
  oldValue: null,
  oldFormatted: null,
  callForPrice: false,
  ...extra,
});

export const categories: Category[] = [
  {
    id: 1,
    name: 'Computers',
    description: null,
    imageUrl: 'http://store/computers.png',
    parentCategoryId: 0,
    subCategories: [
      { id: 4, name: 'Desktops', description: null, imageUrl: null, parentCategoryId: 1, subCategories: [] },
      { id: 5, name: 'Notebooks', description: null, imageUrl: null, parentCategoryId: 1, subCategories: [] },
    ],
  },
  { id: 2, name: 'Electronics', description: null, imageUrl: null, parentCategoryId: 0, subCategories: [] },
];

export const productSummary = (id: number, name = `Product ${id}`, value = 10 * id): ProductSummary => ({
  id,
  name,
  shortDescription: null,
  imageUrl: `http://store/p${id}.png`,
  price: price(value),
  ratingSum: 0,
  reviewCount: 0,
});

export const paged = (items: ProductSummary[], pageIndex = 0, totalCount = items.length, hasNextPage = false): PagedResult<ProductSummary> => ({
  items,
  pageIndex,
  pageSize: 20,
  totalCount,
  totalPages: hasNextPage ? pageIndex + 2 : pageIndex + 1,
  hasNextPage,
});

export const ramAttribute: Attribute = {
  id: 2,
  name: 'RAM',
  textPrompt: null,
  isRequired: true,
  controlType: 'dropdown',
  values: [
    { id: 3, name: '2 GB', priceAdjustment: null, isPreSelected: false, colorSquaresRgb: null },
    { id: 4, name: '8 GB', priceAdjustment: '+$60.00', isPreSelected: false, colorSquaresRgb: null },
  ],
};

export const softwareAttribute: Attribute = {
  id: 5,
  name: 'Software',
  textPrompt: null,
  isRequired: false,
  controlType: 'checkboxes',
  values: [
    { id: 10, name: 'Office', priceAdjustment: '+$50.00', isPreSelected: true, colorSquaresRgb: null },
    { id: 11, name: 'Acrobat', priceAdjustment: null, isPreSelected: false, colorSquaresRgb: null },
  ],
};

export const engravingAttribute: Attribute = {
  id: 7,
  name: 'Engraving',
  textPrompt: 'Text to engrave',
  isRequired: true,
  controlType: 'text',
  values: [],
};

export const giftWrapping: Attribute = {
  id: 1,
  name: 'Gift wrapping',
  textPrompt: null,
  isRequired: true,
  controlType: 'dropdown',
  values: [
    { id: 1, name: 'No', priceAdjustment: null, isPreSelected: true, colorSquaresRgb: null },
    { id: 2, name: 'Yes', priceAdjustment: '+$10.00', isPreSelected: false, colorSquaresRgb: null },
  ],
};

export const productDetails = (extra: Partial<ProductDetails> = {}): ProductDetails => ({
  id: 1,
  name: 'Build your own computer',
  shortDescription: 'Build it',
  fullDescription: '<p>Fight back against cluttered workspaces</p>',
  sku: 'COMP_CUST',
  imageUrls: ['http://store/p1.png'],
  price: price(1200),
  inStock: true,
  stockAvailability: 'In stock',
  canAddToCart: true,
  cannotAddToCartReason: null,
  orderMinimumQuantity: 1,
  orderMaximumQuantity: 10000,
  attributes: [ramAttribute, softwareAttribute],
  ratingSum: 5,
  reviewCount: 1,
  ...extra,
});

export const cartItem = (id: number, quantity = 1, extra: Partial<CartItem> = {}): CartItem => ({
  id,
  productId: id,
  productName: `Product ${id}`,
  imageUrl: null,
  attributeInfo: null,
  quantity,
  unitPrice: '$10.00',
  subTotal: `$${(10 * quantity).toFixed(2)}`,
  subTotalValue: 10 * quantity,
  warnings: [],
  ...extra,
});

export const cart = (items: CartItem[], extra: Partial<Cart> = {}): Cart => {
  const subTotal = items.reduce((sum, item) => sum + item.subTotalValue, 0);
  return {
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totals: {
      subTotal: `$${subTotal.toFixed(2)}`,
      subTotalValue: subTotal,
      subTotalDiscount: null,
      shipping: items.length ? '$0.00' : null,
      requiresShipping: items.length > 0,
      paymentMethodFee: null,
      tax: '$0.00',
      orderTotalDiscount: null,
      total: `$${subTotal.toFixed(2)}`,
      totalValue: subTotal,
    },
    warnings: [],
    ...extra,
  };
};

export const address: Address = {
  id: 3,
  firstName: 'John',
  lastName: 'Smith',
  email: 'john@example.com',
  company: null,
  countryId: 237,
  countryName: 'United States of America',
  stateProvinceId: 1828,
  stateProvinceName: 'New York',
  city: 'New York',
  address1: '350 Fifth Avenue',
  address2: null,
  zipPostalCode: '10118',
  phoneNumber: '2125550100',
};

export const checkoutState = (extra: Partial<CheckoutState> = {}): CheckoutState => ({
  requiresShipping: true,
  checkoutAttributes: [],
  billingAddress: null,
  shippingAddress: null,
  selectedShippingMethod: null,
  warnings: [],
  selectedPaymentMethod: null,
  cart: cart([cartItem(1, 2)]),
  canConfirm: false,
  ...extra,
});

export const orderDetails = (extra: Partial<OrderDetails> = {}): OrderDetails => ({
  id: 7,
  customOrderNumber: '7',
  createdOnUtc: '2026-11-19T21:48:00Z',
  orderStatus: 'Pending',
  paymentStatus: 'Pending',
  shippingStatus: 'Not yet shipped',
  orderTotal: '$3,195.00',
  paymentMethod: 'Check / Money Order',
  shippingMethod: 'Next Day Air',
  subTotal: '$3,195.00',
  shipping: '$0.00',
  tax: '$0.00',
  billingAddress: address,
  shippingAddress: address,
  items: [
    { productId: 1, productName: 'Build your own computer', attributeInfo: 'RAM: 8GB<br />HDD: 400 GB', quantity: 2, unitPrice: '$1,475.00', subTotal: '$2,950.00' },
  ],
  ...extra,
});
