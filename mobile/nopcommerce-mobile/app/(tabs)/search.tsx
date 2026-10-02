import { Link } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CategorySimpleModelDto } from '../../src/api/types';
import { useCatalogRoot, useSearch } from '../../src/hooks/queries';
import { DemoBanner } from '../../src/ui/components/DemoBanner';
import { ProductCard } from '../../src/ui/components/ProductCard';
import { EmptyState, ErrorState, Loading, Screen } from '../../src/ui/components/Screen';
import { colors, radius, spacing, typography } from '../../src/ui/theme';

function CategoryRow({ category, depth = 0 }: { category: CategorySimpleModelDto; depth?: number }) {
  return (
    <View>
      <Link href={{ pathname: '/category/[id]', params: { id: String(category.id) } }} asChild>
        <Pressable style={[styles.categoryRow, { paddingLeft: spacing.lg + depth * spacing.lg }]} accessibilityRole="button">
          <Text style={[typography.body, depth === 0 && styles.categoryTop]}>{category.name}</Text>
          {category.number_of_products !== null ? <Text style={typography.caption}>{category.number_of_products}</Text> : null}
        </Pressable>
      </Link>
      {category.sub_categories.map((child) => (
        <CategoryRow key={child.id} category={child} depth={depth + 1} />
      ))}
    </View>
  );
}

export default function SearchScreen() {
  const [term, setTerm] = useState('');
  const search = useSearch(term);
  const root = useCatalogRoot();
  const active = term.trim().length >= 2;

  return (
    <Screen>
      <DemoBanner />
      <View style={styles.searchBar}>
        <TextInput
          accessibilityLabel="Search products"
          placeholder="Search products"
          placeholderTextColor={colors.textMuted}
          value={term}
          onChangeText={setTerm}
          autoCorrect={false}
          returnKeyType="search"
          style={styles.input}
          testID="search-input"
        />
        {term ? (
          <Pressable onPress={() => setTerm('')} accessibilityLabel="Clear search" style={styles.clear}>
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {!active ? (
        root.isPending ? (
          <Loading />
        ) : root.isError ? (
          <ErrorState error={root.error} onRetry={root.refetch} />
        ) : (
          <FlatList
            data={root.data}
            keyExtractor={(c) => String(c.id)}
            renderItem={({ item }) => <CategoryRow category={item} />}
            ListHeaderComponent={<Text style={styles.heading}>Browse categories</Text>}
            contentContainerStyle={styles.list}
          />
        )
      ) : search.isPending ? (
        <Loading label="Searching…" />
      ) : search.isError ? (
        <ErrorState error={search.error} onRetry={search.refetch} />
      ) : search.data.catalog_products_model.products.length === 0 ? (
        <EmptyState title="No products found" message={`Nothing matches “${term.trim()}”.`} />
      ) : (
        <FlatList
          data={search.data.catalog_products_model.products}
          keyExtractor={(p) => String(p.id)}
          numColumns={2}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <ProductCard product={item} />
            </View>
          )}
          contentContainerStyle={styles.grid}
          ListHeaderComponent={<Text style={styles.resultCount}>{search.data.catalog_products_model.total_items} results</Text>}
          testID="search-results"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBar: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  input: { flex: 1, height: 42, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15, color: colors.text },
  clear: { marginLeft: spacing.sm, padding: spacing.sm },
  clearText: { color: colors.textMuted, fontSize: 16 },
  heading: { ...typography.heading, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  list: { paddingBottom: spacing.xxl },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, paddingRight: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  categoryTop: { fontWeight: '600' },
  grid: { padding: spacing.md, paddingBottom: spacing.xxl },
  gridItem: { width: '50%', padding: spacing.xs },
  resultCount: { ...typography.caption, paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
});
