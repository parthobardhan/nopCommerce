import { ApiError } from './errors';
import type {
  CatalogProductsModelDto,
  CategoryModelDto,
  CategorySimpleModelDto,
  ProductDetailsModelDto,
  ProductOverviewModelDto,
  ShoppingCartModelDto,
  TokenResponse,
} from './types';

/**
 * Lightweight structural guards for responses crossing the network boundary.
 * They check the fields the UI depends on and fail with a descriptive
 * `malformed_response` error instead of letting `undefined` leak into screens.
 */

type Rec = Record<string, unknown>;

export function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(what: string): never {
  throw new ApiError('malformed_response', `Unexpected response from store API: ${what}`);
}

function requireNumber(rec: Rec, key: string, ctx: string): number {
  const v = rec[key];
  if (typeof v !== 'number' || Number.isNaN(v)) fail(`${ctx}.${key} is not a number`);
  return v;
}

function requireString(rec: Rec, key: string, ctx: string): string {
  const v = rec[key];
  if (typeof v !== 'string') fail(`${ctx}.${key} is not a string`);
  return v;
}

function requireArray(rec: Rec, key: string, ctx: string): unknown[] {
  const v = rec[key];
  if (!Array.isArray(v)) fail(`${ctx}.${key} is not an array`);
  return v;
}

export function assertToken(value: unknown): TokenResponse {
  if (!isRecord(value)) fail('token payload is not an object');
  const token = requireString(value, 'token', 'token');
  if (!token) fail('token is empty');
  return value as unknown as TokenResponse;
}

export function assertProductOverview(value: unknown, ctx = 'product'): ProductOverviewModelDto {
  if (!isRecord(value)) fail(`${ctx} is not an object`);
  requireNumber(value, 'id', ctx);
  requireString(value, 'name', ctx);
  if (!isRecord(value.product_price)) fail(`${ctx}.product_price missing`);
  if (!Array.isArray(value.picture_models)) (value as Rec).picture_models = [];
  return value as unknown as ProductOverviewModelDto;
}

export function assertProductList(value: unknown, ctx = 'products'): ProductOverviewModelDto[] {
  if (!Array.isArray(value)) fail(`${ctx} is not an array`);
  return value.map((p, i) => assertProductOverview(p, `${ctx}[${i}]`));
}

export function assertCatalogProducts(value: unknown, ctx = 'catalog_products_model'): CatalogProductsModelDto {
  if (!isRecord(value)) fail(`${ctx} is not an object`);
  assertProductList(requireArray(value, 'products', ctx), `${ctx}.products`);
  return value as unknown as CatalogProductsModelDto;
}

export function assertCategory(value: unknown, ctx = 'category'): CategoryModelDto {
  if (!isRecord(value)) fail(`${ctx} is not an object`);
  requireNumber(value, 'id', ctx);
  requireString(value, 'name', ctx);
  if (!Array.isArray(value.sub_categories)) (value as Rec).sub_categories = [];
  if (value.catalog_products_model !== undefined && value.catalog_products_model !== null) {
    assertCatalogProducts(value.catalog_products_model, `${ctx}.catalog_products_model`);
  } else {
    (value as Rec).catalog_products_model = {
      products: [],
      total_items: 0,
      total_pages: 0,
      page_index: 0,
      page_number: 1,
      page_size: 0,
    };
  }
  return value as unknown as CategoryModelDto;
}

export function assertCategoryList(value: unknown, ctx = 'categories'): CategoryModelDto[] {
  if (!Array.isArray(value)) fail(`${ctx} is not an array`);
  return value.map((c, i) => assertCategory(c, `${ctx}[${i}]`));
}

export function assertSimpleCategoryList(value: unknown, ctx = 'catalog_root'): CategorySimpleModelDto[] {
  if (!Array.isArray(value)) fail(`${ctx} is not an array`);
  return value.map((c, i) => {
    if (!isRecord(c)) fail(`${ctx}[${i}] is not an object`);
    requireNumber(c, 'id', `${ctx}[${i}]`);
    requireString(c, 'name', `${ctx}[${i}]`);
    if (!Array.isArray(c.sub_categories)) (c as Rec).sub_categories = [];
    return c as unknown as CategorySimpleModelDto;
  });
}

export function assertProductDetails(value: unknown): ProductDetailsModelDto {
  const ctx = 'product_details';
  if (!isRecord(value)) fail(`${ctx} is not an object`);
  requireNumber(value, 'id', ctx);
  requireString(value, 'name', ctx);
  if (!isRecord(value.product_price)) fail(`${ctx}.product_price missing`);
  if (!isRecord(value.add_to_cart)) fail(`${ctx}.add_to_cart missing`);
  if (!Array.isArray(value.picture_models)) (value as Rec).picture_models = [];
  if (!isRecord(value.default_picture_model)) {
    (value as Rec).default_picture_model = (value.picture_models as unknown[])[0] ?? { image_url: '' };
  }
  return value as unknown as ProductDetailsModelDto;
}

export function assertCart(value: unknown): ShoppingCartModelDto {
  const ctx = 'cart';
  if (!isRecord(value)) fail(`${ctx} is not an object`);
  const items = requireArray(value, 'items', ctx);
  items.forEach((item, i) => {
    if (!isRecord(item)) fail(`${ctx}.items[${i}] is not an object`);
    requireNumber(item, 'id', `${ctx}.items[${i}]`);
    requireNumber(item, 'product_id', `${ctx}.items[${i}]`);
    requireNumber(item, 'quantity', `${ctx}.items[${i}]`);
    requireString(item, 'product_name', `${ctx}.items[${i}]`);
    if (!Array.isArray(item.warnings)) (item as Rec).warnings = [];
  });
  if (!Array.isArray(value.warnings)) (value as Rec).warnings = [];
  return value as unknown as ShoppingCartModelDto;
}
