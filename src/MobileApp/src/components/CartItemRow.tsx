import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CartItem } from '../api/types';
import { colors, radius, spacing } from '../theme';
import { QuantityStepper } from './QuantityStepper';

interface CartItemRowProps {
  item: CartItem;
  onChangeQuantity: (quantity: number) => void;
  onRemove: () => void;
  busy?: boolean;
}

export function CartItemRow({ item, onChangeQuantity, onRemove, busy }: CartItemRowProps) {
  return (
    <View style={styles.row} testID={`cart-item-${item.id}`}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="contain" /> : <View style={styles.image} />}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {item.productName}
        </Text>
        {item.attributeInfo ? (
          <Text style={styles.attributes} numberOfLines={3}>
            {item.attributeInfo}
          </Text>
        ) : null}
        <Text style={styles.unitPrice}>{item.unitPrice} each</Text>
        <View style={styles.actions}>
          <QuantityStepper value={item.quantity} onChange={onChangeQuantity} min={1} disabled={busy} testID={`cart-item-${item.id}-quantity`} />
          <Pressable testID={`cart-item-${item.id}-remove`} accessibilityRole="button" onPress={busy ? undefined : onRemove}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.subTotal}>{item.subTotal}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  image: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: '#fff' },
  body: { flex: 1, gap: 4 },
  name: { fontWeight: '600', color: colors.text },
  attributes: { color: colors.muted, fontSize: 12 },
  unitPrice: { color: colors.muted, fontSize: 13 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  remove: { color: colors.danger, fontWeight: '500' },
  subTotal: { fontWeight: '700', color: colors.text },
});
