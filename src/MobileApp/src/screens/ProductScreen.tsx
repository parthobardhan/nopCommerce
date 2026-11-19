import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ProductDetails } from '../api/types';
import { AttributeSelector } from '../components/AttributeSelector';
import { Button } from '../components/Button';
import { PriceText } from '../components/PriceText';
import { QuantityStepper } from '../components/QuantityStepper';
import { ErrorList, ErrorView, LoadingView } from '../components/StateViews';
import { useCart } from '../context/CartContext';
import { useApi } from '../context/SessionContext';
import { useAsync } from '../hooks/useAsync';
import { colors, radius, spacing } from '../theme';
import {
  AttributeSelections,
  initialSelections,
  missingRequired,
  selectValue,
  setText,
  toSelectedAttributes,
} from '../utils/attributes';
import { htmlToText } from '../utils/html';

const IMAGE_WIDTH = Dimensions.get('window').width;

function ProductView({ product }: { product: ProductDetails }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const minimumQuantity = Math.max(1, product.orderMinimumQuantity);

  const [selections, setSelections] = useState<AttributeSelections>(() => initialSelections(product.attributes));
  const [quantity, setQuantity] = useState(minimumQuantity);
  const [errors, setErrors] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const onAddToCart = async () => {
    setAdded(false);
    const missing = missingRequired(product.attributes, selections);
    if (missing.length) {
      setErrors(missing.map((name) => `Please select ${name}`));
      return;
    }

    setAdding(true);
    const result = await addToCart(product.id, quantity, toSelectedAttributes(product.attributes, selections));
    setAdding(false);
    setErrors(result);
    setAdded(!result.length);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: product.name }} />
      <ScrollView contentContainerStyle={styles.content} testID="product-screen">
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {product.imageUrls.map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.image} resizeMode="contain" />
          ))}
        </ScrollView>

        <View style={styles.section}>
          <Text style={styles.name}>{product.name}</Text>
          {product.sku ? <Text style={styles.muted}>SKU: {product.sku}</Text> : null}
          <PriceText price={product.price} large />
          {product.stockAvailability ? (
            <Text style={[styles.stock, !product.inStock && styles.outOfStock]}>{product.stockAvailability}</Text>
          ) : null}
          {product.reviewCount ? (
            <Text style={styles.muted}>
              {'★'.repeat(Math.round(product.ratingSum / product.reviewCount))} ({product.reviewCount} reviews)
            </Text>
          ) : null}
          {product.shortDescription ? <Text style={styles.description}>{product.shortDescription}</Text> : null}
        </View>

        {product.attributes.length ? (
          <View style={styles.section}>
            {product.attributes.map((attribute) => (
              <AttributeSelector
                key={attribute.id}
                attribute={attribute}
                selection={selections[attribute.id]}
                onSelect={(valueId) => setSelections((current) => selectValue(current, attribute, valueId))}
                onChangeText={(text) => setSelections((current) => setText(current, attribute, text))}
              />
            ))}
          </View>
        ) : null}

        {product.fullDescription ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{htmlToText(product.fullDescription)}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <ErrorList errors={errors} />
        {added ? (
          <View style={styles.added} testID="added-to-cart">
            <Text style={styles.addedText}>Added to cart</Text>
            <Button title="View cart" variant="secondary" onPress={() => router.push('/cart')} style={styles.viewCart} />
          </View>
        ) : null}
        {product.canAddToCart ? (
          <View style={styles.buyRow}>
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              min={minimumQuantity}
              max={product.orderMaximumQuantity || undefined}
            />
            <Button title="Add to cart" onPress={onAddToCart} loading={adding} style={styles.addButton} testID="add-to-cart" />
          </View>
        ) : (
          <Text style={styles.cannotBuy} testID="cannot-add-to-cart">
            {product.cannotAddToCartReason}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { data: product, loading, error, reload } = useAsync(useCallback(() => api.getProduct(Number(id)), [api, id]));

  if (loading && !product) return <LoadingView />;
  if (error || !product) return <ErrorView message={error ?? 'Product not found'} onRetry={reload} />;

  return <ProductView key={product.id} product={product} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  image: { width: IMAGE_WIDTH, height: IMAGE_WIDTH * 0.8, backgroundColor: '#fff' },
  section: { backgroundColor: colors.surface, padding: spacing.lg, marginTop: spacing.sm, gap: spacing.sm },
  name: { fontSize: 22, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted },
  stock: { color: colors.success, fontWeight: '500' },
  outOfStock: { color: colors.danger },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  description: { color: colors.text, lineHeight: 21 },
  footer: { backgroundColor: colors.surface, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  addButton: { flex: 1 },
  cannotBuy: { color: colors.muted, textAlign: 'center', padding: spacing.sm },
  added: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    backgroundColor: '#E8F6EE',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  addedText: { color: colors.success, fontWeight: '600' },
  viewCart: { minHeight: 36 },
});
