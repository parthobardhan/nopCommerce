import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../src/api/errors';
import { DEMO_CUSTOMER } from '../../src/api/demo/fixtures';
import { useLogin } from '../../src/hooks/queries';
import { useSettings } from '../../src/state/settings';
import { Button } from '../../src/ui/components/Button';
import { DemoBanner } from '../../src/ui/components/DemoBanner';
import { Field } from '../../src/ui/components/Field';
import { Screen } from '../../src/ui/components/Screen';
import { colors, radius, spacing, typography } from '../../src/ui/theme';

export default function LoginScreen() {
  const demoMode = useSettings((s) => s.demoMode);
  const [username, setUsername] = useState(demoMode ? DEMO_CUSTOMER.email : '');
  const [password, setPassword] = useState(demoMode ? DEMO_CUSTOMER.password : '');
  const [error, setError] = useState<string | null>(null);
  const login = useLogin();

  const submit = () => {
    setError(null);
    if (!username.trim() || !password) {
      setError('Enter your email and password');
      return;
    }
    login.mutate(
      { username: username.trim(), password },
      {
        onSuccess: () => router.back(),
        onError: (e) => setError(describeError(e)),
      },
    );
  };

  return (
    <Screen>
      <DemoBanner />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={typography.title}>Sign in</Text>
          {demoMode ? (
            <Text style={styles.hint}>
              Demo account: {DEMO_CUSTOMER.email} / {DEMO_CUSTOMER.password}
            </Text>
          ) : null}
          <Field label="Email" value={username} onChangeText={setUsername} keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="login-email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" testID="login-password" />
          {error ? (
            <Text style={styles.error} testID="login-error">
              {error}
            </Text>
          ) : null}
          <Button title="Sign in" onPress={submit} loading={login.isPending} testID="login-submit" />
          <Link href="/auth/register" replace style={styles.link}>
            New here? Create an account
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.md },
  hint: { ...typography.caption, backgroundColor: colors.demoBanner, color: colors.demoBannerText, padding: spacing.sm, borderRadius: radius.sm },
  error: { color: colors.danger },
  link: { color: colors.primaryDark, fontWeight: '600', textAlign: 'center' },
});
