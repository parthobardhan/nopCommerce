import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import type { ProductSummary } from '../api/types';
import { colors, spacing } from '../theme';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: ProductSummary[];
  onPressProduct: (product: ProductSummary) => void;
  onEndReached?: () => void;
  loadingMore?: boolean;
  header?: React.ReactElement | null;
  empty?: React.ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function ProductGrid({ products, onPressProduct, onEndReached, loadingMore, header, empty, refreshing, onRefresh }: ProductGridProps) {
  return (
    <FlatList
      testID="product-grid"
      data={products}
      keyExtractor={(item) => String(item.id)}
      numColumns={2}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => <ProductCard product={item} onPress={onPressProduct} />}
      ListHeaderComponent={header ?? undefined}
      ListEmptyComponent={empty ?? undefined}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={colors.primaryDark} /> : <View style={styles.footer} />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      refreshing={refreshing ?? false}
      onRefresh={onRefresh}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.sm, backgroundColor: colors.background, flexGrow: 1 },
  footer: { height: 48 },
});
