import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '../../src/state/session';
import { Button } from '../../src/ui/components/Button';
import { DemoBanner } from '../../src/ui/components/DemoBanner';
import { Screen } from '../../src/ui/components/Screen';
import { colors, spacing, typography } from '../../src/ui/theme';

export default function CheckoutCompleteScreen() {
  const { orderId, orderNumber } = useLocalSearchParams<{ orderId?: string; orderNumber?: string }>();
  const signedIn = useSession((s) => Boolean(s.customer?.username));
  const id = Number.parseInt(orderId ?? '', 10);
  return (
    <Screen>
      <DemoBanner />
      <View style={styles.center} testID="order-complete">
        <Text style={styles.check}>✓</Text>
        <Text style={typography.title}>Thank you for your order</Text>
        <Text style={[typography.body, styles.text]}>Order number {orderNumber ?? orderId ?? ''} has been placed and is awaiting processing.</Text>
        {signedIn && Number.isInteger(id) && id > 0 ? (
          <Button title="View order" variant="secondary" onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: String(id) } })} style={styles.button} testID="view-order" />
        ) : (
          <Text style={typography.caption}>Sign in to track this order in your account.</Text>
        )}
        <Button title="Continue shopping" onPress={() => router.replace('/')} style={styles.button} testID="continue-shopping" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  check: { fontSize: 56, color: colors.success, fontWeight: '700' },
  text: { textAlign: 'center', color: colors.textMuted },
  button: { alignSelf: 'stretch' },
});
