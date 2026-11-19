import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

export interface SelectOption {
  value: number;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: number | null;
  options: SelectOption[];
  onChange: (value: number) => void;
  placeholder?: string;
  testID?: string;
}

/** Searchable picker shown in a modal; used for long lists such as countries */
export function SelectField({ label, value, options, onChange, placeholder = 'Select…', testID = 'select' }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return term ? options.filter((option) => option.label.toLowerCase().includes(term)) : options;
  }, [filter, options]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={styles.field}>
        <Text style={selected ? styles.value : styles.placeholder}>{selected?.label ?? placeholder}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable testID={`${testID}-close`} accessibilityRole="button" onPress={() => setOpen(false)}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <TextInput
            testID={`${testID}-filter`}
            placeholder="Search"
            placeholderTextColor={colors.muted}
            value={filter}
            onChangeText={setFilter}
            style={styles.filter}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.value)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                testID={`${testID}-option-${item.value}`}
                accessibilityRole="button"
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                  setFilter('');
                }}
                style={[styles.option, item.value === value && styles.optionSelected]}
              >
                <Text style={styles.optionText}>{item.label}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { color: colors.muted, fontSize: 13, marginBottom: spacing.xs },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  value: { fontSize: 16, color: colors.text },
  placeholder: { fontSize: 16, color: colors.muted },
  chevron: { color: colors.muted },
  modal: { flex: 1, backgroundColor: colors.surface, paddingTop: spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  close: { color: colors.primaryDark, fontSize: 16, fontWeight: '600' },
  filter: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  option: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionSelected: { backgroundColor: '#E6F3FC' },
  optionText: { fontSize: 16, color: colors.text },
});
