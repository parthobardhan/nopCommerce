import type {
  CategoryModelDto,
  PaymentMethodDto,
  PictureModelDto,
  ProductDetailsModelDto,
  ProductOverviewModelDto,
  SelectListItemDto,
  ShippingMethodDto,
} from '../types';
import { formatMoney } from '../../domain/cart';

/**
 * Demo fixtures shaped like the Web API Frontend responses. Content mirrors the
 * nopCommerce sample data; images are bundled copies of the repo's sample
 * images, referenced through the `demo-asset://` scheme (see `demoAssets.ts`).
 */

export const DEMO_ASSET_SCHEME = 'demo-asset://';

function picture(asset: string, title: string): PictureModelDto {
  const url = `${DEMO_ASSET_SCHEME}${asset}`;
  return { image_url: url, thumb_image_url: url, full_size_image_url: url, title, alternate_text: title };
}

export interface DemoProductSeed {
  id: number;
  name: string;
  sku: string;
  price: number;
  oldPrice?: number;
  short: string;
  full: string;
  categoryId: number;
  pictures: string[];
  stock: number;
  markAsNew?: boolean;
  homepage?: boolean;
}

export const DEMO_PRODUCT_SEEDS: DemoProductSeed[] = [
  {
    id: 1,
    name: 'Build your own computer',
    sku: 'COMP_CUST',
    price: 1200,
    short: 'Build it',
    full: 'Fight back against cluttered workspaces with the stylish IBM zBC12 All-in-One desktop PC, featuring powerful computing resources and a stunning 20.1-inch widescreen display with stunning XBRITE-HiColor LCD technology.',
    categoryId: 2,
    pictures: ['product_asuspc_N551JK'],
    stock: 10_000,
    homepage: true,
  },
  {
    id: 4,
    name: 'Apple MacBook Pro',
    sku: 'AP_MBP_13',
    price: 1800,
    short: 'A groundbreaking Retina display. A new force-sensing trackpad. All-flash architecture. Powerful dual-core and quad-core Intel processors.',
    full: 'With fifth-generation Intel Core processors, the latest graphics, and faster flash storage, the incredibly advanced MacBook Pro with Retina display moves even further ahead in performance and battery life.',
    categoryId: 3,
    pictures: ['product_macbook_1', 'product_macbook_2'],
    stock: 3,
    markAsNew: true,
    homepage: true,
  },
  {
    id: 5,
    name: 'Asus Laptop',
    sku: 'AS_551_LP',
    price: 1500,
    short: 'Laptop Asus N551JK Intel Core i7-4710HQ 2.5 GHz, RAM 16GB, HDD 1TB, Video NVidia GTX 850M 4GB, BluRay, 15.6, Full HD, Win 8.1',
    full: 'The ASUS N550JX combines cutting-edge audio and visual technology to deliver an unsurpassed multimedia experience.',
    categoryId: 3,
    pictures: ['product_asuspc_N551JK'],
    stock: 10_000,
  },
  {
    id: 7,
    name: 'Lenovo Thinkpad Carbon Laptop',
    sku: 'LE_TX1_CL',
    price: 1360,
    short: 'Lenovo Thinkpad X1 Carbon Touch Intel Core i7 14 Ultrabook',
    full: 'The X1 Carbon brings a new level of quality to the ThinkPad legacy of high standards and innovation.',
    categoryId: 3,
    pictures: ['product_LenovoThinkpad'],
    stock: 10_000,
    homepage: true,
  },
  {
    id: 18,
    name: 'Apple iPhone 16 128GB',
    sku: 'AP_IPH_16',
    price: 799,
    short: 'The iPhone 16 brings you Dynamic Island, a 48MP Main camera, and USB-C—all in a durable color-infused glass and aluminum design.',
    full: 'Pro-level performance with the A18 chip, longer battery life, and Camera Control.',
    categoryId: 6,
    pictures: ['product_iphone_16_128'],
    stock: 10_000,
    markAsNew: true,
    homepage: true,
  },
  {
    id: 19,
    name: 'Samsung Galaxy S24 Ultra',
    sku: 'SM_S24_UL',
    price: 1299,
    oldPrice: 1399,
    short: 'Galaxy AI is here. Search like never before, get real-time interpretation on a call, and more.',
    full: 'A 200MP camera, built-in S Pen, titanium frame and the brightest, flattest Galaxy display yet.',
    categoryId: 6,
    pictures: ['product_samsung_galaxy_s24'],
    stock: 10_000,
    homepage: true,
  },
  {
    id: 20,
    name: 'Leica T Mirrorless Digital Camera',
    sku: 'LT_MIR_DC',
    price: 530,
    short: 'Leica T (Typ 701) Silver',
    full: 'The new Leica T combines an unmistakable design with intuitive touchscreen operation and the quality of a system camera.',
    categoryId: 7,
    pictures: ['product_LeicaT'],
    stock: 10_000,
  },
  {
    id: 28,
    name: 'Nike Floral Roshe Customized Running Shoes',
    sku: 'NK_FRC_RS',
    price: 40,
    short: 'When you ran across these shoes, you will immediately fell in love and needed a pair of these customized beauties.',
    full: 'Each pair of shoes is handmade and unique, so one shoe might be a bit different than the other.',
    categoryId: 9,
    pictures: ['product_NikeFloralShoe_1', 'product_NikeFloralShoe_2'],
    stock: 10_000,
    homepage: true,
  },
  {
    id: 29,
    name: 'adidas Consortium Campus 80s Running Shoes',
    sku: 'AD_C80_RS',
    price: 71.56,
    short: 'adidas Consortium Campus 80s Primeknit Light Maroon/Running Shoes',
    full: 'Sporty shoes for men and women that are fun, fashionable and easy to wear.',
    categoryId: 9,
    pictures: ['product_adidas'],
    stock: 10_000,
  },
  {
    id: 31,
    name: "Levi's 511 Jeans",
    sku: 'LV_511_JN',
    price: 43.5,
    oldPrice: 55,
    short: "Levi's Faded Black 511 Jeans",
    full: 'Original Levi’s style since 1853, with a slim fit through the thigh and a tapered leg.',
    categoryId: 10,
    pictures: ['product_LeviJeans_1'],
    stock: 10_000,
  },
  {
    id: 33,
    name: 'Nike Tailwind Loose Short-Sleeve Running Shirt',
    sku: 'NK_TLS_RS',
    price: 15,
    short: 'Boost your style and your workout with this loose-fit shirt.',
    full: 'Dri-FIT fabric helps keep you dry and comfortable during long runs.',
    categoryId: 10,
    pictures: ['product_NikeShirt'],
    stock: 10_000,
  },
  {
    id: 38,
    name: 'Fahrenheit 451 by Ray Bradbury',
    sku: 'FR_451_RB',
    price: 27,
    short: 'Fahrenheit 451 is a dystopian novel by Ray Bradbury published in 1953.',
    full: 'The novel presents a future American society where books are outlawed and firemen burn any that are found.',
    categoryId: 12,
    pictures: ['product_Fahrenheit451'],
    stock: 10_000,
  },
  {
    id: 41,
    name: 'Flower Girl Bracelet',
    sku: 'FL_GIRL_B',
    price: 360,
    short: 'Personalised Flower Braceled',
    full: 'This is a great gift for your flower girl to wear on your wedding day.',
    categoryId: 13,
    pictures: ['product_FlowerBracelet'],
    stock: 10_000,
    homepage: true,
  },
];

interface DemoCategorySeed {
  id: number;
  name: string;
  description: string;
  picture?: string;
  parentId: number | null;
  homepage?: boolean;
}

export const DEMO_CATEGORY_SEEDS: DemoCategorySeed[] = [
  { id: 1, name: 'Computers', description: 'Desktops, notebooks and software.', picture: 'category_computers', parentId: null, homepage: true },
  { id: 2, name: 'Desktops', description: 'Pre-built and custom desktop PCs.', picture: 'category_computers', parentId: 1 },
  { id: 3, name: 'Notebooks', description: 'Laptops for work and play.', picture: 'category_computers', parentId: 1 },
  { id: 5, name: 'Electronics', description: 'Phones, cameras and more.', picture: 'category_electronics', parentId: null, homepage: true },
  { id: 6, name: 'Cell phones', description: 'Smartphones from every major brand.', picture: 'category_electronics', parentId: 5 },
  { id: 7, name: 'Camera & photo', description: 'Cameras, lenses and accessories.', picture: 'category_electronics', parentId: 5 },
  { id: 8, name: 'Apparel', description: 'Shoes and clothing.', picture: 'category_apparel', parentId: null, homepage: true },
  { id: 9, name: 'Shoes', description: 'Running, casual and dress shoes.', picture: 'category_shoes', parentId: 8 },
  { id: 10, name: 'Clothing', description: 'Shirts, jeans and more.', picture: 'category_apparel', parentId: 8 },
  { id: 12, name: 'Books', description: 'Fiction and non-fiction.', picture: 'category_book', parentId: null, homepage: true },
  { id: 13, name: 'Jewelry', description: 'Bracelets, rings and necklaces.', picture: 'category_jewelry', parentId: null, homepage: true },
];

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function toOverview(seed: DemoProductSeed): ProductOverviewModelDto {
  return {
    id: seed.id,
    name: seed.name,
    short_description: seed.short,
    full_description: seed.full,
    se_name: slugify(seed.name),
    sku: seed.sku,
    mark_as_new: seed.markAsNew ?? false,
    product_price: {
      price: formatMoney(seed.price),
      price_value: seed.price,
      old_price: seed.oldPrice ? formatMoney(seed.oldPrice) : null,
      old_price_value: seed.oldPrice ?? null,
      disable_buy_button: false,
    },
    picture_models: seed.pictures.map((p) => picture(p, seed.name)),
  };
}

export function toDetails(seed: DemoProductSeed): ProductDetailsModelDto {
  const pictures = seed.pictures.map((p) => picture(p, seed.name));
  const category = DEMO_CATEGORY_SEEDS.find((c) => c.id === seed.categoryId);
  const parent = category?.parentId ? DEMO_CATEGORY_SEEDS.find((c) => c.id === category.parentId) : undefined;
  const breadcrumb = [parent, category].filter((c): c is DemoCategorySeed => Boolean(c)).map((c) => ({ id: c.id, name: c.name, se_name: slugify(c.name) }));
  return {
    id: seed.id,
    name: seed.name,
    short_description: seed.short,
    full_description: seed.full,
    se_name: slugify(seed.name),
    sku: seed.sku,
    stock_availability: seed.stock > 100 ? 'In stock' : `${seed.stock} in stock`,
    default_picture_model: pictures[0],
    picture_models: pictures,
    product_price: {
      current_price: formatMoney(seed.price),
      price_value: seed.price,
      old_price: seed.oldPrice ? formatMoney(seed.oldPrice) : null,
      old_price_value: seed.oldPrice ?? null,
    },
    add_to_cart: {
      product_id: seed.id,
      enter_quantity: 1,
      minimum_quantity: 1,
      maximum_quantity: Math.min(seed.stock, 10_000),
      allowed_quantities: [],
      disable_buy_button: false,
    },
    breadcrumb: { category_breadcrumb: breadcrumb },
  };
}

export function toCategory(seed: DemoCategorySeed, products: ProductOverviewModelDto[], pageNumber = 1, pageSize = 20): CategoryModelDto {
  const start = (pageNumber - 1) * pageSize;
  const page = products.slice(start, start + pageSize);
  const children = DEMO_CATEGORY_SEEDS.filter((c) => c.parentId === seed.id).map((c) => toCategory(c, [], 1, 0));
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    se_name: slugify(seed.name),
    picture_model: seed.picture ? picture(seed.picture, seed.name) : null,
    sub_categories: children,
    catalog_products_model: {
      products: page,
      total_items: products.length,
      total_pages: pageSize ? Math.max(1, Math.ceil(products.length / pageSize)) : 0,
      page_index: pageNumber - 1,
      page_number: pageNumber,
      page_size: pageSize,
      no_results: products.length === 0,
    },
  };
}

export const DEMO_COUNTRIES: SelectListItemDto[] = [
  { text: 'United States', value: '1' },
  { text: 'Canada', value: '2' },
  { text: 'United Kingdom', value: '3' },
  { text: 'Germany', value: '4' },
  { text: 'Australia', value: '5' },
];

export const DEMO_SHIPPING_METHODS: ShippingMethodDto[] = [
  { name: 'Ground', description: 'Shipping by land transport', fee: formatMoney(0), shipping_rate_computation_method_system_name: 'Shipping.FixedByWeightByTotal', selected: true },
  { name: 'Next Day Air', description: 'The one day air shipping', fee: formatMoney(0), shipping_rate_computation_method_system_name: 'Shipping.FixedByWeightByTotal', selected: false },
  { name: '2nd Day Air', description: 'The two day air shipping', fee: formatMoney(0), shipping_rate_computation_method_system_name: 'Shipping.FixedByWeightByTotal', selected: false },
];

export const DEMO_PAYMENT_METHODS: PaymentMethodDto[] = [
  {
    payment_method_system_name: 'Payments.CheckMoneyOrder',
    name: 'Check / Money Order (demo)',
    description: 'Demo payment: no money moves. Mail a check to the store after placing the order.',
    fee: null,
    selected: true,
  },
];

export const DEMO_CUSTOMER = {
  email: 'demo@nopcommerce.local',
  password: 'demo1234',
  first_name: 'Demo',
  last_name: 'Shopper',
};
