import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { ErrorView, LoadingView } from '../components/StateViews';
import { CartProvider } from '../context/CartContext';
import { SessionProvider, useSession } from '../context/SessionContext';
import { colors } from '../theme';

function SessionGate() {
  const { ready, error, customer, retry } = useSession();

  if (!ready) return <LoadingView label="Connecting to the store…" />;
  if (error || !customer) return <ErrorView message={`Could not reach the store. ${error ?? ''}`.trim()} onRetry={retry} />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="category/[id]" options={{ title: 'Category' }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Product' }} />
      <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
      <Stack.Screen name="register" options={{ title: 'Register' }} />
      <Stack.Screen name="orders/index" options={{ title: 'My orders' }} />
      <Stack.Screen name="orders/[id]" options={{ title: 'Order' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <CartProvider>
        <StatusBar style="light" />
        <SessionGate />
      </CartProvider>
    </SessionProvider>
  );
}
