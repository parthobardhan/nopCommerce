import { assertCart, assertCategory, assertProductDetails, assertProductList, assertToken } from '../../src/api/validation';

describe('response guards', () => {
  it('accepts a minimal valid product list and defaults missing pictures', () => {
    const products = assertProductList([{ id: 1, name: 'Thing', product_price: { price: '$1.00', price_value: 1 } }]);
    expect(products[0].picture_models).toEqual([]);
  });

  it('rejects products without an id or price', () => {
    expect(() => assertProductList([{ name: 'No id', product_price: {} }])).toThrow(/id is not a number/);
    expect(() => assertProductList([{ id: 1, name: 'No price' }])).toThrow(/product_price missing/);
  });

  it('fills an empty catalog block for categories that only list sub-categories', () => {
    const category = assertCategory({ id: 3, name: 'Notebooks' });
    expect(category.catalog_products_model.products).toEqual([]);
    expect(category.sub_categories).toEqual([]);
  });

  it('requires add_to_cart on product details', () => {
    expect(() => assertProductDetails({ id: 1, name: 'x', product_price: {} })).toThrow(/add_to_cart missing/);
  });

  it('validates cart items', () => {
    expect(() => assertCart({ items: [{ id: 1, product_id: 2, quantity: 'two', product_name: 'x' }] })).toThrow(/quantity is not a number/);
    expect(assertCart({ items: [] }).warnings).toEqual([]);
  });

  it('rejects empty tokens', () => {
    expect(() => assertToken({ token: '' })).toThrow(/token is empty/);
    expect(() => assertToken('nope')).toThrow(/not an object/);
  });
});
