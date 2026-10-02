import { DemoStoreApi } from '../../src/api/demo/demoStoreApi';
import { DEMO_CUSTOMER } from '../../src/api/demo/fixtures';
import { MemoryTokenStorage } from '../../src/api/tokenStorage';
import type { AddressModelDto } from '../../src/api/types';

const ADDRESS: AddressModelDto = {
  first_name: 'Demo',
  last_name: 'Shopper',
  email: 'demo@nopcommerce.local',
  country_id: 1,
  city: 'New York',
  address1: '21 West 52nd Street',
  zip_postal_code: '10021',
  phone_number: '12345678',
};

function createApi() {
  return new DemoStoreApi({ tokenStorage: new MemoryTokenStorage(), latencyMs: 0, now: () => new Date('2026-10-02T12:00:00Z') });
}

describe('DemoStoreApi', () => {
  it('serves catalog data shaped like the Web API', async () => {
    const api = createApi();
    const categories = await api.getHomepageCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]).toMatchObject({ id: expect.any(Number), name: expect.any(String), catalog_products_model: { products: expect.any(Array) } });

    const notebooks = await api.getCategory(3);
    expect(notebooks.catalog_products_model.products.map((p) => p.name)).toContain('Apple MacBook Pro');

    const details = await api.getProductDetails(4);
    expect(details.product_price.current_price).toBe('$1,800.00');
    expect(details.breadcrumb?.category_breadcrumb.map((c) => c.name)).toEqual(['Computers', 'Notebooks']);
  });

  it('searches by name, sku and description', async () => {
    const api = createApi();
    expect((await api.search('nike')).catalog_products_model.products.map((p) => p.id).sort()).toEqual([28, 33]);
    expect((await api.search('AP_MBP')).catalog_products_model.products[0].id).toBe(4);
    expect((await api.search('x')).catalog_products_model.no_results).toBe(true);
  });

  it('runs the full guest cart → checkout → order flow', async () => {
    const api = createApi();
    await api.getGuestToken();

    expect((await api.addToCart(4, 1)).success).toBe(true);
    expect((await api.addToCart(28, 2)).success).toBe(true);
    expect((await api.addToCart(4, 1)).success).toBe(true);

    let cart = await api.getCart();
    expect(cart.items).toHaveLength(2);
    expect(cart.items.find((i) => i.product_id === 4)?.quantity).toBe(2);
    expect((await api.getCartTotals()).order_total).toBe('$3,680.00');

    cart = await api.updateCartItemQuantity(cart.items[0].id, 1);
    cart = await api.removeCartItem(cart.items[1].id);
    expect(cart.items).toHaveLength(1);
    expect((await api.getCartTotals()).order_total).toBe('$1,800.00');

    const billing = await api.getBillingAddress();
    expect(billing.billing_new_address.available_countries?.length).toBeGreaterThan(0);
    expect(await api.saveBillingAddress(ADDRESS, true)).toMatchObject({ redirect_to_method: 'ShippingMethod' });

    const shipping = await api.getShippingMethods();
    expect(await api.saveShippingMethod(`${shipping.shipping_methods[0].name}___Shipping.FixedByWeightByTotal`)).toMatchObject({ redirect_to_method: 'PaymentMethod' });
    const payment = await api.getPaymentMethods();
    expect(await api.savePaymentMethod(payment.payment_methods[0].payment_method_system_name)).toMatchObject({ redirect_to_method: 'Confirm' });

    expect((await api.getConfirm()).warnings).toEqual([]);
    const placed = await api.confirmOrder();
    expect(placed.completed).toMatchObject({ order_id: 1001, custom_order_number: '1001' });
    expect((await api.getCart()).items).toEqual([]);
  });

  it('refuses checkout steps on an empty cart and invalid addresses', async () => {
    const api = createApi();
    await expect(api.getBillingAddress()).rejects.toMatchObject({ kind: 'validation' });
    await api.addToCart(4, 1);
    expect(await api.saveBillingAddress({ ...ADDRESS, email: 'nope' }, true)).toMatchObject({ wrong_billing_address: true });
    expect(await api.saveShippingMethod('Teleport___Nope')).toMatchObject({ errors: [expect.stringMatching(/shipping method/i)] });
    expect(await api.confirmOrder()).toMatchObject({ errors: expect.arrayContaining([expect.stringMatching(/Billing address/)]) });
  });

  it('enforces stock limits', async () => {
    const api = createApi();
    const result = await api.addToCart(4, 99);
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toMatch(/maximum quantity/);
  });

  it('keeps orders per customer and exposes them in history after login', async () => {
    const api = createApi();
    await api.login(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password, true);
    await api.addToCart(18, 1);
    await api.saveBillingAddress(ADDRESS, true);
    await api.saveShippingMethod('Ground___Shipping.FixedByWeightByTotal');
    await api.savePaymentMethod('Payments.CheckMoneyOrder');
    const placed = await api.confirmOrder();

    const orders = await api.getCustomerOrders();
    expect(orders.orders.map((o) => o.id)).toEqual([placed.completed!.order_id]);
    const details = await api.getOrderDetails(placed.completed!.order_id);
    expect(details.items[0].product_name).toBe('Apple iPhone 16 128GB');
    expect(details.order_total).toBe('$799.00');

    await api.getGuestToken();
    expect((await api.getCustomerOrders()).orders).toEqual([]);
    await expect(api.getOrderDetails(placed.completed!.order_id)).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('rejects bad credentials and duplicate registrations', async () => {
    const api = createApi();
    await expect(api.login(DEMO_CUSTOMER.email, 'wrong', false)).rejects.toMatchObject({ kind: 'validation' });
    const dup = await api.register({ email: DEMO_CUSTOMER.email, password: 'abcdef', confirm_password: 'abcdef', first_name: 'A', last_name: 'B' });
    expect(dup.success).toBe(false);
    const fresh = await api.register({ email: 'new@example.com', password: 'abcdef', confirm_password: 'abcdef', first_name: 'New', last_name: 'User' });
    expect(fresh.success).toBe(true);
    expect((await api.getCustomerInfo()).email).toBe('new@example.com');
  });
});
