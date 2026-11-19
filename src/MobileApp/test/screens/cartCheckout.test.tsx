import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';

import CartScreen from '../../src/screens/CartScreen';
import CheckoutScreen from '../../src/screens/CheckoutScreen';
import { reply, type FakeRequest } from '../fakeApi';
import { address, cart, cartItem, checkoutState, giftWrapping, registeredCustomer } from '../fixtures';
import { renderWithStore, router } from '../render';

describe('CartScreen', () => {
  it('shows an empty cart', async () => {
    await renderWithStore(<CartScreen />);
    expect(await screen.findByText('Your shopping cart is empty.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Start shopping'));
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('updates quantities, removes items and shows warnings', async () => {
    const { api } = await renderWithStore(<CartScreen />, {
      'GET /cart': cart([cartItem(1, 1), cartItem(2, 3)], { warnings: ['Minimum order total is $10'] }),
      'PUT /cart/items/:id': reply(400, { success: false, errors: ['Only 2 left in stock'], cart: cart([cartItem(1, 1), cartItem(2, 3)]) }),
      'DELETE /cart/items/:id': { success: true, errors: [], cart: cart([cartItem(2, 3)]) },
    });

    expect(await screen.findByTestId('cart-item-1')).toBeOnTheScreen();
    expect(screen.getByText('Minimum order total is $10')).toBeOnTheScreen();
    expect(within(screen.getByTestId('totals')).getAllByText('$40.00')).toHaveLength(2);

    await fireEvent.press(screen.getByTestId('cart-item-1-quantity-increase'));
    expect(await screen.findByText('Only 2 left in stock')).toBeOnTheScreen();
    expect(api.calls('PUT /cart/items/:id')[0]).toMatchObject({ path: '/cart/items/1', body: { quantity: 2 } });

    await fireEvent.press(screen.getByTestId('cart-item-1-remove'));
    await waitFor(() => expect(screen.queryByTestId('cart-item-1')).toBeNull());

    await fireEvent.press(screen.getByTestId('checkout-button'));
    expect(router.push).toHaveBeenCalledWith('/checkout');
  });

  it('shows load errors', async () => {
    await renderWithStore(<CartScreen />, { 'GET /cart': reply(500, { error: 'Cart unavailable' }) });
    expect(await screen.findByText('Cart unavailable')).toBeOnTheScreen();
  });
});

const countries = [
  { id: 1, name: 'Canada', twoLetterIsoCode: 'CA' },
  { id: 237, name: 'United States of America', twoLetterIsoCode: 'US' },
];
const states = [{ id: 1828, name: 'New York', abbreviation: 'NY' }];
const shippingMethods = [
  { name: 'Ground', description: 'By land', shippingRateComputationMethodSystemName: 'Shipping.Fixed', fee: '$0.00', selected: false },
  { name: 'Next Day Air', description: null, shippingRateComputationMethodSystemName: 'Shipping.Fixed', fee: '$10.00', selected: false },
];
const paymentMethods = [{ systemName: 'Payments.CheckMoneyOrder', name: 'Check / Money Order', description: null, fee: null, selected: false }];

function checkoutRoutes(overrides: Record<string, unknown> = {}) {
  const withAddress = checkoutState({ billingAddress: address, shippingAddress: address, checkoutAttributes: [giftWrapping] });
  const withShipping = { ...withAddress, selectedShippingMethod: shippingMethods[1] };
  const withPayment = { ...withShipping, selectedPaymentMethod: paymentMethods[0], canConfirm: true };
  return {
    'GET /cart': cart([cartItem(1, 2)]),
    'GET /checkout': checkoutState({ checkoutAttributes: [giftWrapping] }),
    'GET /countries': countries,
    'GET /countries/:id/states': (request: FakeRequest) => (request.path === '/countries/237/states' ? states : []),
    'POST /checkout/address': { success: true, errors: [], state: withAddress },
    'GET /checkout/shipping-methods': { methods: shippingMethods, errors: [] },
    'POST /checkout/shipping-method': { success: true, errors: [], state: withShipping },
    'GET /checkout/payment-methods': paymentMethods,
    'POST /checkout/payment-method': { success: true, errors: [], state: withPayment },
    'POST /checkout/attributes': { success: true, errors: [], state: withPayment },
    'POST /checkout/confirm': { success: true, errors: [], orderId: 7, customOrderNumber: '7' },
    ...overrides,
  };
}

async function fillAddress() {
  await fireEvent.changeText(await screen.findByTestId('address-first-name'), 'John');
  await fireEvent.changeText(screen.getByTestId('address-last-name'), 'Smith');
  await fireEvent.changeText(screen.getByTestId('address-email'), 'john@example.com');
  await fireEvent.press(await screen.findByTestId('address-state'));
  await fireEvent.press(screen.getByTestId('address-state-option-1828'));
  await fireEvent.changeText(screen.getByTestId('address-city'), 'New York');
  await fireEvent.changeText(screen.getByTestId('address-address1'), '350 Fifth Avenue');
  await fireEvent.changeText(screen.getByTestId('address-zip'), '10118');
  await fireEvent.changeText(screen.getByTestId('address-phone'), '2125550100');
}

describe('CheckoutScreen', () => {
  it('walks through address, shipping, payment and review to place an order', async () => {
    const { api } = await renderWithStore(<CheckoutScreen />, checkoutRoutes());

    await fireEvent.press(await screen.findByTestId('address-continue'));
    expect(screen.getByText('First name is required')).toBeOnTheScreen();
    expect(screen.getByText('State / province is required')).toBeOnTheScreen();
    expect(api.calls('POST /checkout/address')).toHaveLength(0);

    await fillAddress();
    await fireEvent.press(screen.getByTestId('address-continue'));
    expect(await screen.findByTestId('step-shipping')).toBeOnTheScreen();
    expect(api.calls('POST /checkout/address')[0].body).toMatchObject({ countryId: 237, stateProvinceId: 1828, city: 'New York' });
    expect(screen.getByTestId('shipping-Shipping.Fixed|Ground')).toBeChecked();

    await fireEvent.press(screen.getByTestId('shipping-Shipping.Fixed|Next Day Air'));
    await fireEvent.press(screen.getByTestId('shipping-continue'));
    expect(await screen.findByTestId('step-payment')).toBeOnTheScreen();
    expect(api.calls('POST /checkout/shipping-method')[0].body).toMatchObject({ name: 'Next Day Air' });

    await fireEvent.press(screen.getByTestId('payment-continue'));
    expect(await screen.findByTestId('step-review')).toBeOnTheScreen();
    expect(api.calls('POST /checkout/payment-method')[0].body).toEqual({ systemName: 'Payments.CheckMoneyOrder' });
    expect(screen.getByText('2 × Product 1')).toBeOnTheScreen();
    expect(screen.getByText('Next Day Air')).toBeOnTheScreen();
    expect(screen.getByText('Check / Money Order')).toBeOnTheScreen();
    expect(screen.getByText(/350 Fifth Avenue/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('attribute-1-value-2'));
    await fireEvent.press(screen.getByTestId('place-order'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/orders/7?placed=1'));
    expect(api.calls('POST /checkout/attributes')[0].body).toEqual({ attributes: [{ id: 1, valueIds: [2] }] });
    expect(api.calls('POST /checkout/confirm')).toHaveLength(1);
  });

  it('prefills the address from the customer and saved billing address', async () => {
    await renderWithStore(<CheckoutScreen />, {
      ...checkoutRoutes({ 'GET /checkout': checkoutState({ billingAddress: { ...address, address2: null, company: null } }) }),
      'POST /session': { token: 'user', customer: registeredCustomer },
    });
    expect(await screen.findByDisplayValue('350 Fifth Avenue')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('john@example.com')).toBeOnTheScreen();
    expect(await screen.findByText('New York')).toBeOnTheScreen();
  });

  it('skips shipping for carts that do not need it and supports going back', async () => {
    const noShipping = checkoutState({ requiresShipping: false, billingAddress: address });
    await renderWithStore(
      <CheckoutScreen />,
      checkoutRoutes({
        'GET /checkout': noShipping,
        'POST /checkout/address': { success: true, errors: [], state: noShipping },
        'POST /checkout/payment-method': { success: true, errors: [], state: { ...noShipping, selectedPaymentMethod: paymentMethods[0] } },
      }),
    );

    expect(await screen.findByText('3. Review')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByTestId('address-continue'));
    expect(await screen.findByTestId('step-payment')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('payment-continue'));
    expect(await screen.findByTestId('step-review')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Back'));
    expect(screen.getByTestId('step-payment')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Back'));
    expect(screen.getByTestId('step-address')).toBeOnTheScreen();
  });

  it('shows store errors at each step', async () => {
    const { api } = await renderWithStore(
      <CheckoutScreen />,
      checkoutRoutes({ 'POST /checkout/address': reply(400, { success: false, errors: ['Zip code is invalid'], state: checkoutState() }) }),
    );

    await fillAddress();
    await fireEvent.press(screen.getByTestId('address-continue'));
    expect(await screen.findByText('Zip code is invalid')).toBeOnTheScreen();
    expect(screen.getByTestId('step-address')).toBeOnTheScreen();

    api.set('POST /checkout/address', { success: true, errors: [], state: checkoutState({ billingAddress: address }) });
    api.set('GET /checkout/shipping-methods', { methods: [], errors: ['No shipping options for this address'] });
    await fireEvent.press(screen.getByTestId('address-continue'));
    expect(await screen.findByText('No shipping options for this address')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('shipping-continue'));
    expect(api.calls('POST /checkout/shipping-method')).toHaveLength(0);

    await fireEvent.press(screen.getByText('Back'));
    expect(screen.getByTestId('step-address')).toBeOnTheScreen();
  });

  it('reports missing checkout attributes and failed orders', async () => {
    const required = { ...giftWrapping, values: giftWrapping.values.map((value) => ({ ...value, isPreSelected: false })) };
    const state = checkoutState({ billingAddress: address, checkoutAttributes: [required] });
    await renderWithStore(
      <CheckoutScreen />,
      checkoutRoutes({
        'GET /checkout': state,
        'POST /checkout/address': { success: true, errors: [], state },
        'POST /checkout/shipping-method': { success: true, errors: [], state },
        'POST /checkout/payment-method': { success: true, errors: [], state },
        'POST /checkout/attributes': { success: true, errors: [], state },
        'POST /checkout/confirm': reply(400, { success: false, errors: ['Payment declined'], orderId: 0, customOrderNumber: null }),
      }),
    );

    await fireEvent.press(await screen.findByTestId('address-continue'));
    await fireEvent.press(await screen.findByTestId('shipping-continue'));
    await fireEvent.press(await screen.findByTestId('payment-continue'));
    await fireEvent.press(await screen.findByTestId('place-order'));
    expect(screen.getByText('Please select Gift wrapping')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('attribute-1-value-1'));
    await fireEvent.press(screen.getByTestId('place-order'));
    expect(await screen.findByText('Payment declined')).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('surfaces request failures and empty payment options', async () => {
    const { api } = await renderWithStore(
      <CheckoutScreen />,
      checkoutRoutes({ 'GET /checkout': checkoutState({ billingAddress: address }), 'GET /checkout/payment-methods': [] }),
    );
    api.set('POST /checkout/shipping-method', reply(500, { error: 'Shipping service down' }));

    await fireEvent.press(await screen.findByTestId('address-continue'));
    await fireEvent.press(await screen.findByTestId('shipping-continue'));
    expect(await screen.findByText('Shipping service down')).toBeOnTheScreen();

    api.set('POST /checkout/shipping-method', { success: true, errors: [], state: checkoutState({ billingAddress: address }) });
    await fireEvent.press(screen.getByTestId('shipping-continue'));
    expect(await screen.findByText('No payment methods are available for the app.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('payment-continue'));
    expect(api.calls('POST /checkout/payment-method')).toHaveLength(0);
  });

  it('changes country and clears the state list', async () => {
    const { api } = await renderWithStore(<CheckoutScreen />, checkoutRoutes());
    expect(await screen.findByTestId('address-state')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('address-country'));
    await fireEvent.press(screen.getByTestId('address-country-option-1'));
    await waitFor(() => expect(screen.queryByTestId('address-state')).toBeNull());
    expect(api.calls('GET /countries/:id/states').map((call) => call.path)).toContain('/countries/1/states');
  });

  it('handles load failures and empty carts', async () => {
    const { unmount } = await renderWithStore(<CheckoutScreen />, checkoutRoutes({ 'GET /checkout': reply(500, { error: 'Checkout unavailable' }) }));
    expect(await screen.findByText('Checkout unavailable')).toBeOnTheScreen();
    await unmount();

    await renderWithStore(<CheckoutScreen />, checkoutRoutes({ 'GET /checkout': checkoutState({ cart: cart([]) }) }));
    expect(await screen.findByText('Your cart is empty.')).toBeOnTheScreen();
  });
});
