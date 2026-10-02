import { Image } from 'expo-image';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { resolveImageSource } from '../../src/api/demo/demoAssets';
import { describeError } from '../../src/api/errors';
import { clampQuantity } from '../../src/domain/cart';
import { parseRouteId, stripHtml } from '../../src/domain/text';
import { useAddToCart, useProduct } from '../../src/hooks/queries';
import { Button } from '../../src/ui/components/Button';
import { DemoBanner } from '../../src/ui/components/DemoBanner';
import { QuantityStepper } from '../../src/ui/components/QuantityStepper';
import { EmptyState, ErrorState, Loading, Screen } from '../../src/ui/components/Screen';
import { colors, radius, spacing, typography } from '../../src/ui/theme';

export default function ProductScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = parseRouteId(params.id);
  const product = useProduct(id);
  const addToCart = useAddToCart();
  const { width } = useWindowDimensions();
  // null until the shopper edits it; otherwise the store's suggested quantity is used.
  const [chosenQuantity, setQuantity] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  if (!id) return <EmptyState title="Product not found" />;
  if (product.isPending) return <Loading />;
  if (product.isError) return <ErrorState error={product.error} onRetry={product.refetch} />;

  const p = product.data;
  const quantity = chosenQuantity ?? clampQuantity(p.add_to_cart.enter_quantity, p.add_to_cart.minimum_quantity, p.add_to_cart.maximum_quantity);
  const canBuy = !p.add_to_cart.disable_buy_button && !p.product_price.call_for_price;
  const pictures = p.picture_models.length ? p.picture_models : [p.default_picture_model];

  const onAdd = () => {
    setFeedback(null);
    addToCart.mutate(
      { productId: p.id, quantity },
      {
        onSuccess: (result) => {
          if (result.success) setFeedback({ kind: 'ok', text: result.message ?? 'Added to your cart' });
          else setFeedback({ kind: 'error', text: result.errors?.join('\n') ?? 'Could not add to cart' });
        },
        onError: (error) => setFeedback({ kind: 'error', text: describeError(error) }),
      },
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: p.name }} />
      <DemoBanner />
      <ScrollView contentContainerStyle={styles.content} testID="product-scroll">
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width }}>
          {pictures.map((picture, index) => {
            const source = resolveImageSource(picture.image_url);
            return (
              <View key={`${picture.image_url}-${index}`} style={[styles.hero, { width }]}>
                {source ? <Image source={source} style={styles.heroImage} contentFit="contain" transition={200} accessibilityLabel={picture.alternate_text ?? p.name} /> : null}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.body}>
          {p.breadcrumb?.category_breadcrumb.length ? (
            <View style={styles.breadcrumb}>
              {p.breadcrumb.category_breadcrumb.map((crumb, index) => (
                <Link key={crumb.id} href={{ pathname: '/category/[id]', params: { id: String(crumb.id) } }} style={styles.crumb}>
                  {index > 0 ? ' › ' : ''}
                  {crumb.name}
                </Link>
              ))}
            </View>
          ) : null}
          <Text style={typography.title} testID="product-name">
            {p.name}
          </Text>
          {p.short_description ? <Text style={[typography.body, styles.short]}>{p.short_description}</Text> : null}

          <View style={styles.priceRow}>
            <Text style={styles.price} testID="product-price">
              {p.product_price.call_for_price ? 'Call for price' : p.product_price.current_price}
            </Text>
            {p.product_price.old_price ? <Text style={styles.oldPrice}>{p.product_price.old_price}</Text> : null}
          </View>
          <View style={styles.meta}>
            {p.sku ? <Text style={typography.caption}>SKU: {p.sku}</Text> : null}
            {p.stock_availability ? <Text style={[typography.caption, styles.stock]}>{p.stock_availability}</Text> : null}
          </View>

          {canBuy ? (
            <View style={styles.buyBox}>
              <Text style={typography.caption}>Quantity</Text>
              <View style={styles.buyRow}>
                <QuantityStepper value={quantity} onChange={setQuantity} min={p.add_to_cart.minimum_quantity} max={p.add_to_cart.maximum_quantity} testID="product-qty" />
                <Button title="Add to cart" onPress={onAdd} loading={addToCart.isPending} style={styles.addButton} testID="add-to-cart" />
              </View>
              {feedback ? (
                <View style={[styles.feedback, feedback.kind === 'ok' ? styles.feedbackOk : styles.feedbackError]} testID="add-feedback">
                  <Text style={feedback.kind === 'ok' ? styles.feedbackOkText : styles.feedbackErrorText}>{feedback.text}</Text>
                  {feedback.kind === 'ok' ? <Button title="View cart" variant="ghost" onPress={() => router.navigate('/cart')} testID="view-cart" /> : null}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.unavailable}>This product cannot be purchased online.</Text>
          )}

          {p.full_description ? (
            <View style={styles.section}>
              <Text style={typography.heading}>Details</Text>
              <Text style={[typography.body, styles.full]}>{stripHtml(p.full_description)}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  hero: { height: 300, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  heroImage: { width: '85%', height: '85%' },
  body: { padding: spacing.lg, gap: spacing.sm },
  breadcrumb: { flexDirection: 'row', flexWrap: 'wrap' },
  crumb: { ...typography.caption, color: colors.primaryDark },
  short: { color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md, marginTop: spacing.sm },
  price: { fontSize: 26, fontWeight: '700', color: colors.text },
  oldPrice: { ...typography.body, color: colors.textMuted, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', gap: spacing.lg },
  stock: { color: colors.success, fontWeight: '600' },
  buyBox: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginTop: spacing.md, gap: spacing.sm },
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  addButton: { flex: 1 },
  feedback: { borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  feedbackOk: { backgroundColor: '#e6f6ea' },
  feedbackError: { backgroundColor: '#fdecec' },
  feedbackOkText: { color: colors.success, fontWeight: '600', flexShrink: 1 },
  feedbackErrorText: { color: colors.danger, flexShrink: 1 },
  unavailable: { ...typography.body, color: colors.warning, marginTop: spacing.md },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  full: { lineHeight: 22 },
});
