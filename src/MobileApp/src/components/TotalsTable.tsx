import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CartTotals } from '../api/types';
import { colors, spacing } from '../theme';

function Row({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={[styles.label, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.value, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

export function TotalsTable({ totals }: { totals: CartTotals }) {
  return (
    <View style={styles.table} testID="totals">
      <Row label="Subtotal" value={totals.subTotal} />
      <Row label="Discount" value={totals.subTotalDiscount ? `-${totals.subTotalDiscount}` : null} />
      {totals.requiresShipping ? <Row label="Shipping" value={totals.shipping} /> : null}
      <Row label="Payment fee" value={totals.paymentMethodFee} />
      <Row label="Tax" value={totals.tax} />
      <Row label="Order discount" value={totals.orderTotalDiscount ? `-${totals.orderTotalDiscount}` : null} />
      <Row label="Total" value={totals.total ?? 'Calculated during checkout'} strong />
    </View>
  );
}

const styles = StyleSheet.create({
  table: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.muted },
  value: { color: colors.text },
  strong: { color: colors.text, fontWeight: '700', fontSize: 17 },
});
