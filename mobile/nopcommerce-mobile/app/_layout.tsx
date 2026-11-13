import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createStoreApi, StoreApiContext } from '../src/api';
import { useRestoreSession } from '../src/hooks/useRestoreSession';
import { useSession } from '../src/state/session';
import { useSettings } from '../src/state/settings';
import { colors } from '../src/ui/theme';

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const hydrated = useSettings((s) => s.hydrated);
  const baseUrl = useSettings((s) => s.baseUrl);
  const demoMode = useSettings((s) => s.demoMode);
  // A new API instance (and a fresh query cache) whenever the target store changes.
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseUrl, demoMode],
  );
  const api = useMemo(
    () =>
      createStoreApi(
        { baseUrl, demoMode },
        {
          onSessionExpired: (guest) => {
            useSession.getState().setCustomer({ customerId: guest.customer_id, username: null });
            queryClient.invalidateQueries();
          },
        },
      ),
    [baseUrl, demoMode, queryClient],
  );

  useRestoreSession(api);

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
