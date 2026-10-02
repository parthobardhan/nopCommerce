import type { PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { describeError } from '../../api/errors';
import { colors, spacing, typography } from '../theme';
import { Button } from './Button';

export function Screen({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} testID="loading">
      <ActivityIndicator size="large" color={colors.primaryDark} />
      <Text style={[typography.caption, styles.gap]}>{label}</Text>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.center} testID="error-state">
      <Text style={typography.heading}>Something went wrong</Text>
      <Text style={[typography.caption, styles.gap, styles.centerText]}>{describeError(error)}</Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} style={styles.gapLg} /> : null}
    </View>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: { title: string; onPress: () => void } }) {
  return (
    <View style={styles.center} testID="empty-state">
      <Text style={typography.heading}>{title}</Text>
      {message ? <Text style={[typography.caption, styles.gap, styles.centerText]}>{message}</Text> : null}
      {action ? <Button title={action.title} onPress={action.onPress} style={styles.gapLg} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  centerText: { textAlign: 'center' },
  gap: { marginTop: spacing.sm },
  gapLg: { marginTop: spacing.lg },
});
