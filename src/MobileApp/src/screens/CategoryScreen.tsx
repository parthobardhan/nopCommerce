import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProductSorting, type ProductSummary } from '../api/types';
import { ProductGrid } from '../components/ProductGrid';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { useApi } from '../context/SessionContext';
import { useAsync } from '../hooks/useAsync';
import { usePagedProducts } from '../hooks/usePagedProducts';
import { colors, radius, spacing } from '../theme';
import { findCategory } from '../utils/categories';

export const SORT_OPTIONS: { label: string; value: ProductSorting }[] = [
  { label: 'Featured', value: ProductSorting.Position },
  { label: 'Name A–Z', value: ProductSorting.NameAsc },
  { label: 'Price ↑', value: ProductSorting.PriceAsc },
  { label: 'Price ↓', value: ProductSorting.PriceDesc },
  { label: 'Newest', value: ProductSorting.CreatedOn },
];

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = Number(id);
  const api = useApi();
  const router = useRouter();
  const [orderBy, setOrderBy] = useState(ProductSorting.Position);

  const tree = useAsync(useCallback(() => api.getCategories(), [api]));
  const category = tree.data ? findCategory(tree.data, categoryId) : null;

  const fetchPage = useCallback((page: number) => api.getCategoryProducts(categoryId, page, orderBy), [api, categoryId, orderBy]);
  const paged = usePagedProducts(fetchPage);

  const openProduct = useCallback((product: ProductSummary) => router.push(`/product/${product.id}`), [router]);

  if ((tree.loading && !tree.data) || (paged.loading && !paged.products.length)) return <LoadingView />;
  if (paged.error && !paged.products.length) return <ErrorView message={paged.error} onRetry={paged.reload} />;

  const subCategories = category?.subCategories ?? [];

  const header = (
    <View>
      <Stack.Screen options={{ title: category?.name ?? 'Category' }} />
      {subCategories.length ? (
        <View style={styles.subCategories}>
          {subCategories.map((sub) => (
            <Pressable
              key={sub.id}
              testID={`subcategory-${sub.id}`}
              accessibilityRole="button"
              onPress={() => router.push(`/category/${sub.id}`)}
              style={styles.subCategory}
            >
              <Text style={styles.subCategoryText}>{sub.name} ›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {paged.products.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sorts}>
          {SORT_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              testID={`sort-${option.value}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: option.value === orderBy }}
              onPress={() => setOrderBy(option.value)}
              style={[styles.sort, option.value === orderBy && styles.sortSelected]}
            >
              <Text style={[styles.sortText, option.value === orderBy && styles.sortTextSelected]}>{option.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {paged.totalCount ? <Text style={styles.count}>{paged.totalCount} products</Text> : null}
    </View>
  );

  return (
    <ProductGrid
      products={paged.products}
      onPressProduct={openProduct}
      onEndReached={paged.loadMore}
      loadingMore={paged.loadingMore}
      header={header}
      empty={subCategories.length ? null : <EmptyView message="No products in this category yet." />}
      refreshing={false}
      onRefresh={paged.reload}
    />
  );
}

const styles = StyleSheet.create({
  subCategories: { gap: spacing.sm, margin: spacing.xs, marginBottom: spacing.md },
  subCategory: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subCategoryText: { fontSize: 16, fontWeight: '600', color: colors.text },
  sorts: { gap: spacing.sm, paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
  sort: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  sortSelected: { borderColor: colors.primaryDark, backgroundColor: '#E6F3FC' },
  sortText: { color: colors.text },
  sortTextSelected: { color: colors.primaryDark, fontWeight: '600' },
  count: { color: colors.muted, marginHorizontal: spacing.xs, marginBottom: spacing.xs },
});
