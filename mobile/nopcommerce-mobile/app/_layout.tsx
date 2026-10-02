import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createStoreApi, StoreApiContext } from '../src/api';
import { useSession } from '../src/state/session';
import { useSettings } from '../src/state/settings';
import { colors } from '../src/ui/theme';

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const hydrated = useSettings((s) => s.hydrated);
  const baseUrl = useSettings((s) => s.baseUrl);
  const demoMode = useSettings((s) => s.demoMode);
  const setCustomer = useSession((s) => s.setCustomer);

  // A new API instance (and a fresh query cache) whenever the target store changes.
  const api = useMemo(() => createStoreApi({ baseUrl, demoMode }), [baseUrl, demoMode]);
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api],
  );

  useEffect(() => {
    setCustomer(null);
    let cancelled = false;
    api
      .getGuestToken()
      .then((token) => {
        if (!cancelled) setCustomer({ customerId: token.customer_id, username: token.username ?? null });
      })
      .catch(() => {
        // Screens surface the connection error through their own queries.
      });
    return () => {
      cancelled = true;
    };
  }, [api, setCustomer]);

  if (!hydrated) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashText}>nopCommerce</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StoreApiContext.Provider value={api}>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.surface }, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="category/[id]" options={{ title: 'Category' }} />
            <Stack.Screen name="product/[id]" options={{ title: 'Product' }} />
            <Stack.Screen name="checkout/index" options={{ title: 'Checkout' }} />
            <Stack.Screen name="checkout/complete" options={{ title: 'Order placed', headerBackVisible: false }} />
            <Stack.Screen name="orders/index" options={{ title: 'My orders' }} />
            <Stack.Screen name="orders/[id]" options={{ title: 'Order details' }} />
            <Stack.Screen name="auth/login" options={{ title: 'Sign in', presentation: 'modal' }} />
            <Stack.Screen name="auth/register" options={{ title: 'Create account', presentation: 'modal' }} />
            <Stack.Screen name="settings" options={{ title: 'Store settings' }} />
          </Stack>
        </QueryClientProvider>
      </StoreApiContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  splashText: { fontSize: 24, fontWeight: '700', color: colors.primaryDark },
});
