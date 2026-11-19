import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import type { ProductSummary } from '../api/types';
import { ProductGrid } from '../components/ProductGrid';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { useApi } from '../context/SessionContext';
import { usePagedProducts } from '../hooks/usePagedProducts';
import { colors, radius, spacing } from '../theme';

export default function SearchScreen() {
  const api = useApi();
  const router = useRouter();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  const fetchPage = useCallback((page: number) => api.searchProducts(query, page), [api, query]);
  const paged = usePagedProducts(query ? fetchPage : null);

  const openProduct = useCallback((product: ProductSummary) => router.push(`/product/${product.id}`), [router]);

  let body: React.ReactElement;
  if (!query) body = <EmptyView message="Search the catalog by product name, SKU or description." />;
  else if (paged.loading) body = <LoadingView label="Searching…" />;
  else if (paged.error) body = <ErrorView message={paged.error} onRetry={paged.reload} />;
  else
    body = (
      <ProductGrid
        products={paged.products}
        onPressProduct={openProduct}
        onEndReached={paged.loadMore}
        loadingMore={paged.loadingMore}
        empty={<EmptyView message={`No products found for “${query}”.`} />}
      />
    );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          testID="search-input"
          accessibilityLabel="Search products"
          placeholder="Search products"
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => setQuery(text.trim())}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchBar: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
});
