import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatAddress } from '../../src/domain/checkout';
import { formatDate, parseRouteId } from '../../src/domain/text';
import { useOrder } from '../../src/hooks/queries';
import { DemoBanner } from '../../src/ui/components/DemoBanner';
import { EmptyState, ErrorState, Loading, Screen } from '../../src/ui/components/Screen';
import { colors, radius, spacing, typography } from '../../src/ui/theme';

export default function OrderDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = parseRouteId(params.id);
  const order = useOrder(id);

  if (!id) return <EmptyState title="Order not found" />;
  if (order.isPending) return <Loading />;
  if (order.isError) return <ErrorState error={order.error} onRetry={order.refetch} />;
  const o = order.data;

  return (
    <Screen>
      <Stack.Screen options={{ title: `Order #${o.custom_order_number}` }} />
      <DemoBanner />
      <ScrollView contentContainerStyle={styles.content} testID="order-details">
        <View style={styles.card}>
          <Text style={typography.caption}>Placed {formatDate(o.created_on)}</Text>
          <Text style={typography.body}>Status: {o.order_status}</Text>
          {o.payment_method ? <Text style={typography.body}>Payment: {o.payment_method}</Text> : null}
          {o.shipping_method ? <Text style={typography.body}>Shipping: {o.shipping_method}</Text> : null}
        </View>
        <View style={styles.card}>
          <Text style={typography.heading}>Items</Text>
          {o.items.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={[typography.body, { flex: 1 }]}>
                {item.quantity} × {item.product_name}
              </Text>
              <Text style={typography.body}>{item.sub_total}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={typography.body}>Subtotal</Text>
            <Text style={typography.body}>{o.order_subtotal}</Text>
          </View>
          {o.order_shipping ? (
            <View style={styles.row}>
              <Text style={typography.body}>Shipping</Text>
              <Text style={typography.body}>{o.order_shipping}</Text>
            </View>
          ) : null}
          {o.tax ? (
            <View style={styles.row}>
              <Text style={typography.body}>Tax</Text>
              <Text style={typography.body}>{o.tax}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.total}>Total</Text>
            <Text style={styles.total}>{o.order_total}</Text>
          </View>
        </View>
        <View style={styles.card}>
          <Text style={typography.heading}>Billing address</Text>
          <Text style={typography.body}>{formatAddress(o.billing_address)}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  total: { ...typography.price },
});
