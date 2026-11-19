import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';

import AccountScreen from '../../src/screens/AccountScreen';
import OrderDetailsScreen from '../../src/screens/OrderDetailsScreen';
import OrdersScreen from '../../src/screens/OrdersScreen';
import RegisterScreen from '../../src/screens/RegisterScreen';
import { reply } from '../fakeApi';
import { orderDetails, registeredCustomer } from '../fixtures';
import { renderWithStore, router, setParams } from '../render';

const userSession = { token: 'user-token', customer: registeredCustomer };

describe('AccountScreen', () => {
  it('validates and signs in', async () => {
    const { api } = await renderWithStore(<AccountScreen />, {
      'POST /auth/login': (request: { body: { password: string } }) =>
        request.body.password === 'secret1'
          ? { success: true, errors: [], session: userSession }
          : reply(400, { success: false, errors: ['The credentials provided are incorrect'], session: null }),
    });

    await fireEvent.press(await screen.findByTestId('login-submit'));
    expect(screen.getByText('Enter a valid email address')).toBeOnTheScreen();
    expect(api.calls('POST /auth/login')).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId('login-email'), ' jane@example.com ');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'wrong');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('The credentials provided are incorrect')).toBeOnTheScreen();
    expect(api.calls('POST /auth/login')[0].body).toEqual({ email: 'jane@example.com', password: 'wrong' });

    await fireEvent.changeText(screen.getByTestId('login-password'), 'secret1');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Jane Doe')).toBeOnTheScreen();
    expect(screen.getByText('jane@example.com')).toBeOnTheScreen();
  });

  it('links to registration', async () => {
    await renderWithStore(<AccountScreen />);
    await fireEvent.press(await screen.findByTestId('go-register'));
    expect(router.push).toHaveBeenCalledWith('/register');
  });

  it('shows the profile, opens orders and signs out', async () => {
    await SecureStore.setItemAsync('nop_mobile_api_token', 'user-token');
    const { api } = await renderWithStore(<AccountScreen />, {
      'GET /customer': { ...registeredCustomer, firstName: null, lastName: null },
      'POST /auth/logout': { success: true },
    });

    expect(await screen.findByText('My account')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('go-orders'));
    expect(router.push).toHaveBeenCalledWith('/orders');

    await fireEvent.press(screen.getByTestId('logout'));
    expect(await screen.findByTestId('login-form')).toBeOnTheScreen();
    expect(api.calls('POST /auth/logout')[0].token).toBe('user-token');
    expect(await SecureStore.getItemAsync('nop_mobile_api_token')).toBe('guest-token');
  });
});

describe('RegisterScreen', () => {
  async function fill(password = 'secret1', confirm = password) {
    await fireEvent.changeText(await screen.findByTestId('register-first-name'), 'Jane');
    await fireEvent.changeText(screen.getByTestId('register-last-name'), 'Doe');
    await fireEvent.changeText(screen.getByTestId('register-email'), 'jane@example.com');
    await fireEvent.changeText(screen.getByTestId('register-password'), password);
    await fireEvent.changeText(screen.getByTestId('register-confirm-password'), confirm);
  }

  it('validates locally before calling the store', async () => {
    const { api } = await renderWithStore(<RegisterScreen />);
    await fill('123', '456');
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(screen.getByText('Passwords do not match')).toBeOnTheScreen();
    expect(screen.getByText('Password must be at least 6 characters')).toBeOnTheScreen();
    expect(api.calls('POST /auth/register')).toHaveLength(0);
  });

  it('registers and returns to the previous screen', async () => {
    const { api } = await renderWithStore(<RegisterScreen />, { 'POST /auth/register': { success: true, errors: [], session: userSession } });
    await fill();
    await fireEvent.press(screen.getByTestId('register-submit'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(api.calls('POST /auth/register')[0].body).toEqual({ email: 'jane@example.com', password: 'secret1', firstName: 'Jane', lastName: 'Doe' });
  });

  it('shows store errors', async () => {
    await renderWithStore(<RegisterScreen />, {
      'POST /auth/register': reply(400, { success: false, errors: ['The specified email already exists'], session: null }),
    });
    await fill();
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByText('The specified email already exists')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('OrdersScreen', () => {
  it('lists orders and opens one', async () => {
    await renderWithStore(<OrdersScreen />, { 'GET /orders': [orderDetails()] });
    expect(await screen.findByText('Order #7')).toBeOnTheScreen();
    expect(screen.getByText('$3,195.00')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('order-7'));
    expect(router.push).toHaveBeenCalledWith('/orders/7');
  });

  it('shows an empty state', async () => {
    await renderWithStore(<OrdersScreen />, { 'GET /orders': [] });
    expect(await screen.findByText('You have not placed any orders yet.')).toBeOnTheScreen();
  });

  it('shows load errors with retry', async () => {
    await renderWithStore(<OrdersScreen />, { 'GET /orders': reply(500, { error: 'Orders unavailable' }) });
    expect(await screen.findByText('Orders unavailable')).toBeOnTheScreen();
  });
});

describe('OrderDetailsScreen', () => {
  it('shows a confirmation after checkout', async () => {
    setParams({ id: '7', placed: '1' });
    await renderWithStore(<OrderDetailsScreen />, { 'GET /orders/:id': orderDetails() });

    expect(await screen.findByTestId('order-placed')).toBeOnTheScreen();
    expect(screen.getByText('Check / Money Order (Pending)')).toBeOnTheScreen();
    expect(screen.getByText('Next Day Air (Not yet shipped)')).toBeOnTheScreen();
    expect(screen.getByText('RAM: 8GB\nHDD: 400 GB')).toBeOnTheScreen();
    expect(screen.getByText('Billing address')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('continue-shopping'));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('shows past orders without shipping or confirmation', async () => {
    setParams({ id: '8' });
    await renderWithStore(<OrderDetailsScreen />, {
      'GET /orders/:id': orderDetails({ shippingMethod: null, shippingAddress: null, paymentMethod: null, items: [{ ...orderDetails().items[0], attributeInfo: null }] }),
    });
    expect(await screen.findByTestId('order-details')).toBeOnTheScreen();
    expect(screen.queryByTestId('order-placed')).toBeNull();
    expect(screen.queryByText('Shipping address')).toBeNull();
  });

  it('shows not found errors', async () => {
    setParams({ id: '99' });
    await renderWithStore(<OrderDetailsScreen />, { 'GET /orders/:id': reply(404, { error: 'Order not found' }) });
    expect(await screen.findByText('Order not found')).toBeOnTheScreen();
  });
});
