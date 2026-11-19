import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import CategoryScreen from '../../src/screens/CategoryScreen';
import HomeScreen from '../../src/screens/HomeScreen';
import ProductScreen from '../../src/screens/ProductScreen';
import SearchScreen from '../../src/screens/SearchScreen';
import { reply } from '../fakeApi';
import { cart, cartItem, categories, engravingAttribute, paged, productDetails, productSummary, ramAttribute } from '../fixtures';
import { renderWithStore, router, setParams } from '../render';

describe('HomeScreen', () => {
  it('shows categories and featured products and navigates', async () => {
    await renderWithStore(<HomeScreen />, {
      'GET /categories': categories,
      'GET /products/featured': [productSummary(1, 'Build your own computer'), productSummary(4, 'Apple MacBook Pro')],
    });

    expect(await screen.findByText('Apple MacBook Pro')).toBeOnTheScreen();
    expect(screen.getByText('Electronics')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('category-1'));
    expect(router.push).toHaveBeenCalledWith('/category/1');
    await fireEvent.press(screen.getByTestId('product-card-4'));
    expect(router.push).toHaveBeenCalledWith('/product/4');
  });

  it('shows an error with retry', async () => {
    const { api } = await renderWithStore(<HomeScreen />, { 'GET /categories': reply(500, { error: 'Catalog unavailable' }), 'GET /products/featured': [] });
    expect(await screen.findByText('Catalog unavailable')).toBeOnTheScreen();

    api.set('GET /categories', categories);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Computers')).toBeOnTheScreen();
  });
});

describe('CategoryScreen', () => {
  it('lists subcategories and products, and re-sorts', async () => {
    setParams({ id: '1' });
    const { api } = await renderWithStore(<CategoryScreen />, {
      'GET /categories': categories,
      'GET /categories/:id/products': paged([productSummary(7, 'HP Spectre'), productSummary(8, 'HP Envy')], 0, 2),
    });

    expect(await screen.findByText('HP Spectre')).toBeOnTheScreen();
    expect(screen.getByText('Notebooks ›')).toBeOnTheScreen();
    expect(screen.getByText('2 products')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('subcategory-5'));
    expect(router.push).toHaveBeenCalledWith('/category/5');

    await fireEvent.press(screen.getByTestId('sort-10'));
    await waitFor(() => expect(api.calls('GET /categories/:id/products').at(-1)?.query.get('orderBy')).toBe('10'));
    expect(screen.getByTestId('sort-10')).toBeChecked();

    await fireEvent.press(screen.getByTestId('product-card-8'));
    expect(router.push).toHaveBeenCalledWith('/product/8');
  });

  it('loads the next page at the end of the list', async () => {
    setParams({ id: '5' });
    const { api } = await renderWithStore(<CategoryScreen />, {
      'GET /categories': categories,
      'GET /categories/:id/products': (request: { query: URLSearchParams }) =>
        request.query.get('page') === '0' ? paged([productSummary(1)], 0, 2, true) : paged([productSummary(2)], 1, 2, false),
    });

    await screen.findByTestId('product-card-1');
    await fireEvent(screen.getByTestId('product-grid'), 'onEndReached');
    expect(await screen.findByTestId('product-card-2')).toBeOnTheScreen();
    expect(api.calls('GET /categories/:id/products').map((call) => call.query.get('page'))).toEqual(['0', '1']);
  });

  it('shows an empty state for leaf categories without products', async () => {
    setParams({ id: '2' });
    await renderWithStore(<CategoryScreen />, { 'GET /categories': categories, 'GET /categories/:id/products': paged([]) });
    expect(await screen.findByText('No products in this category yet.')).toBeOnTheScreen();
  });

  it('shows product loading errors', async () => {
    setParams({ id: '2' });
    await renderWithStore(<CategoryScreen />, { 'GET /categories': categories, 'GET /categories/:id/products': reply(404, { error: 'Category not found' }) });
    expect(await screen.findByText('Category not found')).toBeOnTheScreen();
  });
});

describe('SearchScreen', () => {
  it('prompts, searches on submit and shows results', async () => {
    const { api } = await renderWithStore(<SearchScreen />, {
      'GET /products/search': (request: { query: URLSearchParams }) =>
        request.query.get('q') === 'htc' ? paged([productSummary(18, 'HTC smartphone')]) : paged([]),
    });

    expect(screen.getByText('Search the catalog by product name, SKU or description.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('search-input'), ' htc ');
    await fireEvent(screen.getByTestId('search-input'), 'submitEditing');
    expect(await screen.findByText('HTC smartphone')).toBeOnTheScreen();
    expect(api.calls('GET /products/search')[0].query.get('q')).toBe('htc');

    await fireEvent.press(screen.getByTestId('product-card-18'));
    expect(router.push).toHaveBeenCalledWith('/product/18');

    await fireEvent.changeText(screen.getByTestId('search-input'), 'zzz');
    await fireEvent(screen.getByTestId('search-input'), 'submitEditing');
    expect(await screen.findByText('No products found for “zzz”.')).toBeOnTheScreen();
  });

  it('shows search errors', async () => {
    await renderWithStore(<SearchScreen />, { 'GET /products/search': reply(400, { error: 'Search term is too short' }) });
    await fireEvent.changeText(screen.getByTestId('search-input'), 'a');
    await fireEvent(screen.getByTestId('search-input'), 'submitEditing');
    expect(await screen.findByText('Search term is too short')).toBeOnTheScreen();
  });
});

describe('ProductScreen', () => {
  beforeEach(() => setParams({ id: '1' }));

  it('shows details and requires mandatory attributes before adding to cart', async () => {
    const { api } = await renderWithStore(<ProductScreen />, {
      'GET /products/:id': productDetails(),
      'POST /cart/items': { success: true, errors: [], cart: cart([cartItem(1, 2)]) },
    });

    expect(await screen.findByText('SKU: COMP_CUST')).toBeOnTheScreen();
    expect(screen.getByText('$1200.00')).toBeOnTheScreen();
    expect(screen.getByText('In stock')).toBeOnTheScreen();
    expect(screen.getByText('★★★★★ (1 reviews)')).toBeOnTheScreen();
    expect(screen.getByText('Fight back against cluttered workspaces')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('add-to-cart'));
    expect(screen.getByText('Please select RAM')).toBeOnTheScreen();
    expect(api.calls('POST /cart/items')).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('attribute-2-value-4'));
    await fireEvent.press(screen.getByTestId('attribute-5-value-11'));
    await fireEvent.press(screen.getByTestId('quantity-increase'));
    await fireEvent.press(screen.getByTestId('add-to-cart'));

    expect(await screen.findByTestId('added-to-cart')).toBeOnTheScreen();
    expect(api.calls('POST /cart/items')[0].body).toEqual({
      productId: 1,
      quantity: 2,
      attributes: [
        { id: 2, valueIds: [4] },
        { id: 5, valueIds: [10, 11] },
      ],
    });

    await fireEvent.press(screen.getByText('View cart'));
    expect(router.push).toHaveBeenCalledWith('/cart');
  });

  it('starts at the minimum quantity and shows store errors', async () => {
    const { api } = await renderWithStore(<ProductScreen />, {
      'GET /products/:id': productDetails({ attributes: [engravingAttribute], orderMinimumQuantity: 2, reviewCount: 0, sku: null }),
      'POST /cart/items': reply(400, { success: false, errors: ['The maximum quantity allowed is 1'], cart: cart([]) }),
    });

    expect(await screen.findByTestId('quantity-value')).toHaveTextContent('2');
    await fireEvent.changeText(screen.getByTestId('attribute-7-text'), 'For Jane');
    await fireEvent.press(screen.getByTestId('add-to-cart'));

    expect(await screen.findByText('The maximum quantity allowed is 1')).toBeOnTheScreen();
    expect(api.calls('POST /cart/items')[0].body.attributes).toEqual([{ id: 7, valueIds: [], text: 'For Jane' }]);
  });

  it('explains why a product cannot be bought', async () => {
    await renderWithStore(<ProductScreen />, {
      'GET /products/:id': productDetails({ canAddToCart: false, cannotAddToCartReason: 'Out of stock', inStock: false, stockAvailability: 'Out of stock', attributes: [ramAttribute] }),
    });
    expect(await screen.findByTestId('cannot-add-to-cart')).toHaveTextContent('Out of stock');
    expect(screen.queryByTestId('add-to-cart')).toBeNull();
  });

  it('shows not found errors', async () => {
    await renderWithStore(<ProductScreen />, { 'GET /products/:id': reply(404, { error: 'Product not found' }) });
    expect(await screen.findByText('Product not found')).toBeOnTheScreen();
  });
});
