import { Link, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCustomerInfo, useLogout } from '../../src/hooks/queries';
import { useSession } from '../../src/state/session';
import { useSettings } from '../../src/state/settings';
import { Button } from '../../src/ui/components/Button';
import { DemoBanner } from '../../src/ui/components/DemoBanner';
import { Screen } from '../../src/ui/components/Screen';
import { colors, radius, spacing, typography } from '../../src/ui/theme';

function MenuRow({ title, subtitle, href, testID }: { title: string; subtitle?: string; href: Parameters<typeof router.push>[0]; testID?: string }) {
  return (
    <Pressable onPress={() => router.push(href)} style={styles.menuRow} accessibilityRole="button" testID={testID}>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle ? <Text style={typography.caption}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function AccountScreen() {
  const signedIn = useSession((s) => Boolean(s.customer?.username));
  const info = useCustomerInfo(signedIn);
  const logout = useLogout();
  const { baseUrl, demoMode } = useSettings();

  return (
    <Screen>
      <DemoBanner />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {signedIn ? (
            <>
              <Text style={typography.title}>
                {info.data ? `${info.data.first_name ?? ''} ${info.data.last_name ?? ''}`.trim() || info.data.email : 'Welcome back'}
              </Text>
              {info.data ? <Text style={typography.caption}>{info.data.email}</Text> : null}
              <Button title="Sign out" variant="secondary" onPress={() => logout.mutate()} loading={logout.isPending} style={styles.cardButton} testID="sign-out" />
            </>
          ) : (
            <>
              <Text style={typography.title}>You are shopping as a guest</Text>
              <Text style={[typography.caption, styles.cardText]}>Sign in to see your order history and check out faster.</Text>
              <Button title="Sign in" onPress={() => router.push('/auth/login')} style={styles.cardButton} testID="sign-in" />
              <Link href="/auth/register" style={styles.link}>
                Create an account
              </Link>
            </>
          )}
        </View>

        <View style={styles.menu}>
          <MenuRow title="My orders" subtitle={signedIn ? 'Track and review past orders' : 'Sign in to see your orders'} href="/orders" testID="menu-orders" />
          <MenuRow title="Store settings" subtitle={demoMode ? 'Demo mode (sample data)' : baseUrl} href="/settings" testID="menu-settings" />
        </View>

        <Text style={styles.footer}>nopCommerce mobile · {demoMode ? 'demo mode' : 'live store'}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cardText: { marginTop: spacing.sm, textAlign: 'center' },
  cardButton: { marginTop: spacing.lg, alignSelf: 'stretch' },
  link: { color: colors.primaryDark, fontWeight: '600', marginTop: spacing.md },
  menu: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  menuTitle: { ...typography.body, fontWeight: '600' },
  chevron: { fontSize: 24, color: colors.textMuted, marginLeft: spacing.md },
  footer: { ...typography.caption, textAlign: 'center' },
});
