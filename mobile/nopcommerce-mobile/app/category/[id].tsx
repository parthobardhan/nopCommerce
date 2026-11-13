import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { parseRouteId } from '../../src/domain/text';
import { useCategory } from '../../src/hooks/queries';
import { Button } from '../../src/ui/components/Button';
import { DemoBanner } from '../../src/ui/components/DemoBanner';
import { ProductCard } from '../../src/ui/components/ProductCard';
import { EmptyState, ErrorState, Loading, Screen } from '../../src/ui/components/Screen';
import { colors, radius, spacing, typography } from '../../src/ui/theme';

export default function CategoryScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = parseRouteId(params.id);
  const [page, setPage] = useState(1);
  const category = useCategory(id, page);

  if (!id) return <EmptyState title="Category not found" />;

  return (
    <Screen>
      <Stack.Screen options={{ title: category.data?.name ?? 'Category' }} />
      <DemoBanner />
      {category.isPending ? (
        <Loading />
      ) : category.isError ? (
        <ErrorState error={category.error} onRetry={category.refetch} />
      ) : (
        <FlatList
          data={category.data.catalog_products_model.products}
          keyExtractor={(p) => String(p.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <ProductCard product={item} />
            </View>
          )}
          ListHeaderComponent={
            <View>
              {category.data.description ? <Text style={styles.description}>{category.data.description}</Text> : null}
              {category.data.sub_categories.length ? (
                <View style={styles.chips}>
                  {category.data.sub_categories.map((sub) => (
                    <Link key={sub.id} href={{ pathname: '/category/[id]', params: { id: String(sub.id) } }} asChild>
                      <Pressable style={styles.chip} accessibilityRole="button" testID={`subcategory-${sub.id}`}>
                        <Text style={styles.chipText}>{sub.name}</Text>
                      </Pressable>
                    </Link>
                  ))}
                </View>
              ) : null}
              <Text style={styles.count}>{category.data.catalog_products_model.total_items} products</Text>
            </View>
          }
          ListEmptyComponent={<EmptyState title="No products in this category yet" />}
          ListFooterComponent={
            category.data.catalog_products_model.total_pages > 1 ? (
              <View style={styles.pager}>
                <Button title="Previous" variant="secondary" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
                <Text style={typography.caption}>
                  Page {page} of {category.data.catalog_products_model.total_pages}
                </Text>
                <Button title="Next" variant="secondary" disabled={page >= category.data.catalog_products_model.total_pages} onPress={() => setPage((p) => p + 1)} />
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { padding: spacing.md, paddingBottom: spacing.xxl },
  gridItem: { width: '50%', padding: spacing.xs },
  description: { ...typography.body, color: colors.textMuted, paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
  chip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipText: { ...typography.body, fontWeight: '600' },
  count: { ...typography.caption, paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
});
