import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

export interface Choice {
  key: string;
  title: string;
  subtitle?: string | null;
  trailing?: string | null;
}

interface ChoiceListProps {
  choices: Choice[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  testID?: string;
}

export function ChoiceList({ choices, selectedKey, onSelect, testID = 'choice' }: ChoiceListProps) {
  return (
    <View style={styles.list}>
      {choices.map((choice) => {
        const selected = choice.key === selectedKey;
        return (
          <Pressable
            key={choice.key}
            testID={`${testID}-${choice.key}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onSelect(choice.key)}
            style={[styles.item, selected && styles.selected]}
          >
            <View style={[styles.radio, selected && styles.radioSelected]} />
            <View style={styles.body}>
              <Text style={styles.title}>{choice.title}</Text>
              {choice.subtitle ? <Text style={styles.subtitle}>{choice.subtitle}</Text> : null}
            </View>
            {choice.trailing ? <Text style={styles.trailing}>{choice.trailing}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  selected: { borderColor: colors.primaryDark, backgroundColor: '#F0F8FE' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
  radioSelected: { borderColor: colors.primaryDark, backgroundColor: colors.primaryDark },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  subtitle: { color: colors.muted, fontSize: 13 },
  trailing: { fontWeight: '600', color: colors.text },
});
