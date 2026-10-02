import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDate } from '../../src/domain/text';
import { useOrders } from '../../src/hooks/queries';
import { useSession } from '../../src/state/session';
import { DemoBanner } from '../../src/ui/components/DemoBanner';
import { EmptyState, ErrorState, Loading, Screen } from '../../src/ui/components/Screen';
import { colors, radius, spacing, typography } from '../../src/ui/theme';

export default function OrdersScreen() {
  const signedIn = useSession((s) => Boolean(s.customer?.username));
  const orders = useOrders(signedIn);

  if (!signedIn) {
    return (
      <Screen>
        <DemoBanner />
        <EmptyState title="Sign in to see your orders" action={{ title: 'Sign in', onPress: () => router.push('/auth/login') }} />
      </Screen>
    );
  }
  if (orders.isPending) return <Loading label="Loading orders…" />;
  if (orders.isError) return <ErrorState error={orders.error} onRetry={orders.refetch} />;

  return (
    <Screen>
      <DemoBanner />
      <FlatList
        data={orders.data.orders}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="No orders yet" message="Orders you place will show up here." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/orders/[id]', params: { id: String(item.id) } })} style={styles.card} accessibilityRole="button" testID={`order-${item.id}`}>
            <View style={styles.row}>
              <Text style={styles.number}>Order #{item.custom_order_number}</Text>
              <Text style={typography.price}>{item.order_total}</Text>
            </View>
            <Text style={typography.caption}>{formatDate(item.created_on)}</Text>
            <View style={styles.statuses}>
              <Status label={item.order_status} />
              <Status label={item.payment_status} />
              <Status label={item.shipping_status} />
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

function Status({ label }: { label: string }) {
  return (
    <View style={styles.status}>
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { ...typography.body, fontWeight: '700' },
  statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  status: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: 12, color: colors.textMuted },
});
