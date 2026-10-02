import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveImageSource } from '../../api/demo/demoAssets';
import type { ProductOverviewModelDto } from '../../api/types';
import { colors, radius, spacing, typography } from '../theme';

export function ProductCard({ product }: { product: ProductOverviewModelDto }) {
  const source = resolveImageSource(product.picture_models[0]?.image_url);
  return (
    <Link href={{ pathname: '/product/[id]', params: { id: String(product.id) } }} asChild>
      <Pressable style={styles.card} accessibilityRole="button" testID={`product-card-${product.id}`}>
        <View style={styles.imageWrap}>
          {source ? <Image source={source} style={styles.image} contentFit="contain" transition={150} /> : <View style={styles.placeholder} />}
          {product.mark_as_new ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>NEW</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={typography.price}>{product.product_price.price}</Text>
          {product.product_price.old_price ? <Text style={styles.oldPrice}>{product.product_price.old_price}</Text> : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageWrap: { aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, backgroundColor: colors.surfaceMuted },
  badge: { position: 'absolute', top: spacing.sm, left: spacing.sm, backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: colors.primaryText, fontSize: 11, fontWeight: '700' },
  name: { ...typography.body, fontWeight: '600', marginTop: spacing.sm, minHeight: 40 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xs },
  oldPrice: { ...typography.caption, textDecorationLine: 'line-through' },
});
