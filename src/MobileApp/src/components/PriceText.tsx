import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Price } from '../api/types';
import { colors } from '../theme';

export function PriceText({ price, large }: { price: Price; large?: boolean }) {
  if (!price.formatted) return null;

  return (
    <View style={styles.row}>
      {price.oldFormatted ? <Text style={styles.old}>{price.oldFormatted}</Text> : null}
      <Text style={[styles.price, large && styles.large, price.callForPrice && styles.callForPrice]}>{price.formatted}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  price: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  large: { fontSize: 24 },
  old: { color: colors.muted, textDecorationLine: 'line-through', fontSize: 13 },
  callForPrice: { color: colors.muted, fontWeight: '500' },
});
