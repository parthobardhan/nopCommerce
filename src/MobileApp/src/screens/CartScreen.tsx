import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { CartItemRow } from '../components/CartItemRow';
import { EmptyView, ErrorList, ErrorView, LoadingView } from '../components/StateViews';
import { TotalsTable } from '../components/TotalsTable';
import { useCart } from '../context/CartContext';
import { colors, radius, spacing } from '../theme';

export default function CartScreen() {
  const router = useRouter();
  const { cart, loading, error, refresh, updateQuantity, removeItem } = useCart();
  const [errors, setErrors] = useState<string[]>([]);
  const [busyItem, setBusyItem] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const run = async (itemId: number, operation: () => Promise<string[]>) => {
    setBusyItem(itemId);
    setErrors(await operation());
    setBusyItem(null);
  };

  if (!cart && loading) return <LoadingView />;
  if (!cart && error) return <ErrorView message={error} onRetry={refresh} />;
  if (!cart || !cart.items.length)
    return (
      <EmptyView message="Your shopping cart is empty.">
        <Button title="Start shopping" onPress={() => router.push('/')} style={styles.startShopping} />
      </EmptyView>
    );

  return (
    <View style={styles.container}>
      <FlatList
        data={cart.items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<ErrorList errors={[...errors, ...cart.warnings]} />}
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            busy={busyItem === item.id}
            onChangeQuantity={(quantity) => run(item.id, () => updateQuantity(item.id, quantity))}
            onRemove={() => run(item.id, () => removeItem(item.id))}
          />
        )}
        refreshing={loading}
        onRefresh={refresh}
      />
      <View style={styles.summary}>
        <TotalsTable totals={cart.totals} />
        <Button title="Checkout" onPress={() => router.push('/checkout')} testID="checkout-button" style={styles.checkout} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md },
  summary: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  checkout: { marginTop: spacing.xs },
  startShopping: { minWidth: 180 },
});
