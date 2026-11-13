import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { clampQuantity, parseQuantityInput } from '../../domain/cart';
import { colors, radius, spacing } from '../theme';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  testID?: string;
}

export function QuantityStepper({ value, onChange, min = 1, max = 10_000, disabled, testID = 'quantity' }: QuantityStepperProps) {
  const update = (next: number) => onChange(clampQuantity(next, min, max));
  return (
    <View style={[styles.row, disabled && styles.disabled]} testID={testID}>
      <Pressable accessibilityLabel="Decrease quantity" onPress={() => update(value - 1)} disabled={disabled || value <= min} style={styles.button} testID={`${testID}-minus`}>
        <Text style={styles.symbol}>−</Text>
      </Pressable>
      <TextInput
        accessibilityLabel="Quantity"
        style={styles.input}
        keyboardType="number-pad"
        value={String(value)}
        editable={!disabled}
        onChangeText={(text) => {
          const parsed = parseQuantityInput(text);
          if (parsed !== null) update(parsed);
        }}
        testID={`${testID}-input`}
      />
      <Pressable accessibilityLabel="Increase quantity" onPress={() => update(value + 1)} disabled={disabled || value >= max} style={styles.button} testID={`${testID}-plus`}>
        <Text style={styles.symbol}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', alignSelf: 'flex-start' },
  disabled: { opacity: 0.5 },
  button: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  symbol: { fontSize: 20, color: colors.text, lineHeight: 22 },
  input: { width: 52, height: 40, textAlign: 'center', fontSize: 16, color: colors.text, paddingVertical: 0, paddingHorizontal: spacing.xs },
});
