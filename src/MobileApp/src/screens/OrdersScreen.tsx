import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { useApi } from '../context/SessionContext';
import { useAsync } from '../hooks/useAsync';
import { colors, radius, spacing } from '../theme';
import { formatDate } from '../utils/format';

export default function OrdersScreen() {
  const api = useApi();
  const router = useRouter();
  const { data, loading, error, reload } = useAsync(useCallback(() => api.getOrders(), [api]));

  if (loading && !data) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={reload} />;

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(order) => String(order.id)}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<EmptyView message="You have not placed any orders yet." />}
      refreshing={loading}
      onRefresh={reload}
      renderItem={({ item }) => (
        <Pressable
          testID={`order-${item.id}`}
          accessibilityRole="button"
          onPress={() => router.push(`/orders/${item.id}`)}
          style={styles.card}
        >
          <View style={styles.row}>
            <Text style={styles.number}>Order #{item.customOrderNumber}</Text>
            <Text style={styles.total}>{item.orderTotal}</Text>
          </View>
          <Text style={styles.muted}>
            {formatDate(item.createdOnUtc)} · {item.orderStatus}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  number: { fontWeight: '700', color: colors.text },
  total: { fontWeight: '700', color: colors.accent },
  muted: { color: colors.muted },
});
