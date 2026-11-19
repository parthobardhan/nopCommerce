import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Category, ProductSummary } from '../api/types';
import { ProductGrid } from '../components/ProductGrid';
import { ErrorView, LoadingView } from '../components/StateViews';
import { useApi } from '../context/SessionContext';
import { useAsync } from '../hooks/useAsync';
import { colors, radius, spacing } from '../theme';

export default function HomeScreen() {
  const api = useApi();
  const router = useRouter();

  const loadHome = useCallback(async () => {
    const [categories, featured] = await Promise.all([api.getCategories(), api.getFeaturedProducts()]);
    return { categories, featured };
  }, [api]);
  const { data, loading, error, reload } = useAsync(loadHome);

  const openProduct = useCallback((product: ProductSummary) => router.push(`/product/${product.id}`), [router]);
  const openCategory = useCallback((category: Category) => router.push(`/category/${category.id}`), [router]);

  if (loading && !data) return <LoadingView />;
  if (error && !data) return <ErrorView message={error} onRetry={reload} />;

  const header = (
    <View>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Welcome to our store</Text>
        <Text style={styles.heroText}>Browse categories or search for products.</Text>
      </View>
      <Text style={styles.sectionTitle}>Categories</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {data?.categories.map((category) => (
          <Pressable
            key={category.id}
            testID={`category-${category.id}`}
            accessibilityRole="button"
            onPress={() => openCategory(category)}
            style={styles.category}
          >
            {category.imageUrl ? <Image source={{ uri: category.imageUrl }} style={styles.categoryImage} /> : null}
            <Text style={styles.categoryName} numberOfLines={1}>
              {category.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.sectionTitle}>Featured products</Text>
    </View>
  );

  return (
    <ProductGrid
      products={data?.featured ?? []}
      onPressProduct={openProduct}
      header={header}
      refreshing={loading}
      onRefresh={reload}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    padding: spacing.xl,
    margin: spacing.xs,
    marginBottom: spacing.md,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  heroText: { color: '#E6F3FC', marginTop: spacing.xs },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginHorizontal: spacing.xs, marginVertical: spacing.sm },
  categories: { paddingHorizontal: spacing.xs, gap: spacing.sm, paddingBottom: spacing.sm },
  category: {
    width: 110,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryImage: { width: 80, height: 80, borderRadius: radius.sm, marginBottom: spacing.xs },
  categoryName: { fontWeight: '600', color: colors.text },
});
