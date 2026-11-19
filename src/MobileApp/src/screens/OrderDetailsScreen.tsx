import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Address } from '../api/types';
import { Button } from '../components/Button';
import { ErrorView, LoadingView } from '../components/StateViews';
import { useApi } from '../context/SessionContext';
import { useAsync } from '../hooks/useAsync';
import { colors, radius, spacing } from '../theme';
import { formatDate } from '../utils/format';

function AddressBlock({ title, address }: { title: string; address: Address | null }) {
  if (!address) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.text}>
        {[
          `${address.firstName} ${address.lastName}`,
          address.address1,
          [address.city, address.stateProvinceName, address.zipPostalCode].filter(Boolean).join(', '),
          address.countryName,
        ]
          .filter(Boolean)
          .join('\n')}
      </Text>
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.muted, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.text, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

export default function OrderDetailsScreen() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const api = useApi();
  const router = useRouter();
  const { data: order, loading, error, reload } = useAsync(useCallback(() => api.getOrder(Number(id)), [api, id]));

  if (loading && !order) return <LoadingView />;
  if (error || !order) return <ErrorView message={error ?? 'Order not found'} onRetry={reload} />;

  return (
    <ScrollView contentContainerStyle={styles.content} testID="order-details">
      <Stack.Screen options={{ title: `Order #${order.customOrderNumber}` }} />
      {placed ? (
        <View style={styles.success} testID="order-placed">
          <Text style={styles.successTitle}>Thank you!</Text>
          <Text style={styles.successText}>Your order #{order.customOrderNumber} has been placed.</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Line label="Date" value={formatDate(order.createdOnUtc)} />
        <Line label="Status" value={order.orderStatus} />
        <Line label="Payment" value={`${order.paymentMethod ?? ''} (${order.paymentStatus})`} />
        {order.shippingMethod ? <Line label="Shipping" value={`${order.shippingMethod} (${order.shippingStatus})`} /> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Items</Text>
        {order.items.map((item, index) => (
          <View key={`${item.productId}-${index}`} style={styles.item}>
            <Text style={styles.text}>
              {item.quantity} × {item.productName}
            </Text>
            {item.attributeInfo ? <Text style={styles.attributes}>{item.attributeInfo.replace(/<br\s*\/?>/gi, '\n')}</Text> : null}
            <Text style={styles.strong}>{item.subTotal}</Text>
          </View>
        ))}
      </View>

      <AddressBlock title="Billing address" address={order.billingAddress} />
      <AddressBlock title="Shipping address" address={order.shippingAddress} />

      <View style={styles.card}>
        <Line label="Subtotal" value={order.subTotal} />
        {order.shippingMethod ? <Line label="Shipping" value={order.shipping} /> : null}
        <Line label="Tax" value={order.tax} />
        <Line label="Total" value={order.orderTotal} strong />
      </View>

      {placed ? <Button title="Continue shopping" onPress={() => router.replace('/')} testID="continue-shopping" /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background, flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  cardTitle: { fontWeight: '700', color: colors.text },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  item: { gap: 2, paddingVertical: spacing.xs },
  attributes: { color: colors.muted, fontSize: 12 },
  text: { color: colors.text, lineHeight: 20, flexShrink: 1 },
  muted: { color: colors.muted },
  strong: { fontWeight: '700', color: colors.text },
  success: { backgroundColor: '#E8F6EE', borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  successTitle: { fontSize: 20, fontWeight: '700', color: colors.success },
  successText: { color: colors.text },
});
