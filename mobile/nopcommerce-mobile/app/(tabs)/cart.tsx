import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveImageSource } from '../../src/api/demo/demoAssets';
import { describeError } from '../../src/api/errors';
import type { ShoppingCartItemModelDto } from '../../src/api/types';
import { useCart, useCartTotals, useRemoveCartItem, useUpdateCartItem } from '../../src/hooks/queries';
import { Button } from '../../src/ui/components/Button';
import { DemoBanner } from '../../src/ui/components/DemoBanner';
import { QuantityStepper } from '../../src/ui/components/QuantityStepper';
import { EmptyState, ErrorState, Loading, Screen } from '../../src/ui/components/Screen';
import { colors, radius, spacing, typography } from '../../src/ui/theme';

function CartLine({ item }: { item: ShoppingCartItemModelDto }) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const busy = update.isPending || remove.isPending;
  const source = resolveImageSource(item.picture?.image_url);
  return (
    <View style={styles.line} testID={`cart-line-${item.id}`}>
      <Link href={{ pathname: '/product/[id]', params: { id: String(item.product_id) } }} asChild>
        <Pressable accessibilityRole="imagebutton">
          {source ? <Image source={source} style={styles.thumb} contentFit="contain" /> : <View style={styles.thumb} />}
        </Pressable>
      </Link>
      <View style={styles.lineBody}>
        <Text style={styles.lineName} numberOfLines={2}>
          {item.product_name}
        </Text>
        {item.attribute_info ? <Text style={typography.caption}>{item.attribute_info}</Text> : null}
        <Text style={typography.caption}>{item.unit_price} each</Text>
        <View style={styles.lineControls}>
          <QuantityStepper value={item.quantity} onChange={(quantity) => update.mutate({ itemId: item.id, quantity })} disabled={busy} testID={`qty-${item.id}`} />
          <Pressable onPress={() => remove.mutate(item.id)} disabled={busy} accessibilityRole="button" accessibilityLabel={`Remove ${item.product_name}`} testID={`remove-${item.id}`}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
        {item.warnings.map((w) => (
          <Text key={w} style={styles.warning}>
            {w}
          </Text>
        ))}
        {update.isError ? <Text style={styles.warning}>{describeError(update.error)}</Text> : null}
      </View>
      <Text style={styles.lineTotal}>{item.sub_total}</Text>
    </View>
  );
}

export default function CartScreen() {
  const cart = useCart();
  const hasItems = Boolean(cart.data?.items.length);
  const totals = useCartTotals(hasItems);

  if (cart.isPending) {
    return (
      <Screen>
        <DemoBanner />
        <Loading label="Loading cart…" />
      </Screen>
    );
  }
  if (cart.isError) {
    return (
      <Screen>
        <DemoBanner />
        <ErrorState error={cart.error} onRetry={cart.refetch} />
      </Screen>
    );
  }
  if (!hasItems) {
    return (
      <Screen>
        <DemoBanner />
        <EmptyState title="Your cart is empty" message="Browse the catalog and add something you like." action={{ title: 'Start shopping', onPress: () => router.navigate('/') }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <DemoBanner />
      <FlatList data={cart.data.items} keyExtractor={(i) => String(i.id)} renderItem={({ item }) => <CartLine item={item} />} contentContainerStyle={styles.list} testID="cart-list" />
      <View style={styles.summary} testID="cart-summary">
        {cart.data.warnings.map((w) => (
          <Text key={w} style={styles.warning}>
            {w}
          </Text>
        ))}
        <Row label="Subtotal" value={totals.data?.sub_total ?? '—'} />
        {totals.data?.requires_shipping ? <Row label="Shipping" value={totals.data.shipping ?? 'Calculated at checkout'} /> : null}
        <Row label="Tax" value={totals.data?.tax ?? '—'} />
        <Row label="Total" value={totals.data?.order_total ?? '—'} bold />
        <Button title="Checkout" onPress={() => router.push('/checkout')} style={styles.checkout} testID="checkout-button" />
      </View>
    </Screen>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[typography.body, bold && styles.bold]}>{label}</Text>
      <Text style={[typography.body, bold && styles.bold]} testID={`total-${label.toLowerCase()}`}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.md },
  line: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  lineBody: { flex: 1, marginLeft: spacing.md, gap: spacing.xs },
  lineName: { ...typography.body, fontWeight: '600' },
  lineControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  remove: { color: colors.danger, fontWeight: '600' },
  warning: { color: colors.warning, fontSize: 13 },
  lineTotal: { ...typography.price, marginLeft: spacing.sm },
  summary: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  bold: { fontWeight: '700', fontSize: 17 },
  checkout: { marginTop: spacing.sm },
});
