import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { resolveImageSource } from '../../src/api/demo/demoAssets';
import type { CategoryModelDto } from '../../src/api/types';
import { useHomepageCategories, useHomepageProducts } from '../../src/hooks/queries';
import { DemoBanner } from '../../src/ui/components/DemoBanner';
import { ProductCard } from '../../src/ui/components/ProductCard';
import { ErrorState, Loading, Screen } from '../../src/ui/components/Screen';
import { colors, radius, spacing, typography } from '../../src/ui/theme';

function CategoryTile({ category }: { category: CategoryModelDto }) {
  const source = resolveImageSource(category.picture_model?.image_url);
  return (
    <Link href={{ pathname: '/category/[id]', params: { id: String(category.id) } }} asChild>
      <Pressable style={styles.tile} accessibilityRole="button" testID={`category-tile-${category.id}`}>
        {source ? <Image source={source} style={styles.tileImage} contentFit="cover" transition={150} /> : <View style={styles.tileImage} />}
        <Text style={styles.tileLabel} numberOfLines={1}>
          {category.name}
        </Text>
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const categories = useHomepageCategories();
  const products = useHomepageProducts();

  if (categories.isPending || products.isPending) {
    return (
      <Screen>
        <DemoBanner />
        <Loading label="Loading store…" />
      </Screen>
    );
  }
  if (categories.isError || products.isError) {
    const refetch = () => {
      categories.refetch();
      products.refetch();
    };
    return (
      <Screen>
        <DemoBanner />
        <ErrorState error={categories.error ?? products.error} onRetry={refetch} />
        <Link href="/settings" style={styles.settingsLink}>
          Check store settings
        </Link>
      </Screen>
    );
  }

  const refreshing = categories.isRefetching || products.isRefetching;
  const onRefresh = () => {
    categories.refetch();
    products.refetch();
  };

  return (
    <Screen>
      <DemoBanner />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} testID="home-scroll">
        <Text style={styles.heading}>Shop by category</Text>
        <FlatList
          horizontal
          data={categories.data}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) => <CategoryTile category={item} />}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tileRow}
          ItemSeparatorComponent={() => <View style={{ width: spacing.md }} />}
        />
        <Text style={styles.heading}>Featured products</Text>
        <View style={styles.grid}>
          {products.data.map((product) => (
            <View key={product.id} style={styles.gridItem}>
              <ProductCard product={product} />
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  heading: { ...typography.heading, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  tileRow: { paddingHorizontal: spacing.lg },
  tile: { width: 120 },
  tileImage: { width: 120, height: 90, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  tileLabel: { ...typography.body, fontWeight: '600', marginTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md },
  gridItem: { width: '50%', padding: spacing.xs },
  settingsLink: { color: colors.primaryDark, textAlign: 'center', paddingBottom: spacing.xl, fontWeight: '600' },
});
