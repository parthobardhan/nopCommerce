import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';
import { Button } from './Button';

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} testID="loading">
      <ActivityIndicator size="large" color={colors.primaryDark} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center} testID="error-view">
      <Text style={styles.error}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} style={styles.retry} /> : null}
    </View>
  );
}

export function EmptyView({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <View style={styles.center}>
      <Text style={styles.muted}>{message}</Text>
      {children}
    </View>
  );
}

export function ErrorList({ errors, testID = 'error-list' }: { errors: string[]; testID?: string }) {
  if (!errors.length) return null;
  return (
    <View style={styles.errorBox} testID={testID} accessibilityRole="alert">
      {errors.map((error) => (
        <Text key={error} style={styles.errorText}>
          {error}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  muted: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 15, textAlign: 'center' },
  retry: { minWidth: 160 },
  errorBox: {
    backgroundColor: '#FDECEC',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorText: { color: colors.danger, fontSize: 14 },
});
