import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  testID?: string;
}

export function QuantityStepper({ value, onChange, min = 1, max = 10000, disabled, testID = 'quantity' }: QuantityStepperProps) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  return (
    <View style={styles.row} testID={testID}>
      <Pressable
        testID={`${testID}-decrease`}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        accessibilityState={{ disabled: !canDecrease }}
        disabled={!canDecrease}
        onPress={() => onChange(value - 1)}
        style={[styles.button, !canDecrease && styles.disabled]}
      >
        <Text style={styles.symbol}>−</Text>
      </Pressable>
      <Text style={styles.value} testID={`${testID}-value`}>
        {value}
      </Text>
      <Pressable
        testID={`${testID}-increase`}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        accessibilityState={{ disabled: !canIncrease }}
        disabled={!canIncrease}
        onPress={() => onChange(value + 1)}
        style={[styles.button, !canIncrease && styles.disabled]}
      >
        <Text style={styles.symbol}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  disabled: { opacity: 0.4 },
  symbol: { fontSize: 20, color: colors.text },
  value: { minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text },
});
