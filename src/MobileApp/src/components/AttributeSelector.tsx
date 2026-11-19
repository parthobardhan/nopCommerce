import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Attribute } from '../api/types';
import { colors, radius, spacing } from '../theme';
import type { AttributeSelection } from '../utils/attributes';

interface AttributeSelectorProps {
  attribute: Attribute;
  selection: AttributeSelection | undefined;
  onSelect: (valueId: number) => void;
  onChangeText: (text: string) => void;
}

/** Renders product / checkout attributes as option chips (dropdown, radio, color, image, checkboxes) or a text input */
export function AttributeSelector({ attribute, selection, onSelect, onChangeText }: AttributeSelectorProps) {
  const title = `${attribute.textPrompt || attribute.name}${attribute.isRequired ? ' *' : ''}`;

  if (attribute.controlType === 'unsupported') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.muted}>This option can only be set on the website.</Text>
      </View>
    );
  }

  if (attribute.controlType === 'text' || attribute.controlType === 'multiline') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <TextInput
          testID={`attribute-${attribute.id}-text`}
          accessibilityLabel={attribute.name}
          value={selection?.text ?? ''}
          onChangeText={onChangeText}
          multiline={attribute.controlType === 'multiline'}
          style={styles.input}
        />
      </View>
    );
  }

  const multiple = attribute.controlType === 'checkboxes';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.options}>
        {attribute.values.map((value) => {
          const selected = !!selection?.valueIds.includes(value.id);
          return (
            <Pressable
              key={value.id}
              testID={`attribute-${attribute.id}-value-${value.id}`}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: selected }}
              onPress={() => onSelect(value.id)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              {value.colorSquaresRgb ? <View style={[styles.swatch, { backgroundColor: value.colorSquaresRgb }]} /> : null}
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {multiple ? (selected ? '☑ ' : '☐ ') : ''}
                {value.name}
                {value.priceAdjustment ? ` (${value.priceAdjustment})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  title: { fontWeight: '600', color: colors.text, marginBottom: spacing.sm, fontSize: 15 },
  muted: { color: colors.muted },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primaryDark, backgroundColor: '#E6F3FC' },
  optionText: { color: colors.text, fontSize: 14 },
  optionTextSelected: { color: colors.primaryDark, fontWeight: '600' },
  swatch: { width: 16, height: 16, borderRadius: 8, marginRight: 6, borderWidth: 1, borderColor: colors.border },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.text,
  },
});
