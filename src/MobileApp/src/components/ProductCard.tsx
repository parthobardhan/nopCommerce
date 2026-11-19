import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ProductSummary } from '../api/types';
import { colors, radius, spacing } from '../theme';
import { PriceText } from './PriceText';

export function ProductCard({ product, onPress }: { product: ProductSummary; onPress: (product: ProductSummary) => void }) {
  return (
    <Pressable
      testID={`product-card-${product.id}`}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      onPress={() => onPress(product)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="contain" /> : <View style={styles.image} />}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <PriceText price={product.price} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    margin: spacing.xs,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  image: { width: '100%', aspectRatio: 1, backgroundColor: '#fff' },
  body: { padding: spacing.sm, gap: spacing.xs },
  name: { color: colors.text, fontSize: 14, fontWeight: '500', minHeight: 36 },
});
