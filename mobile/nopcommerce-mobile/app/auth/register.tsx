import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../src/api/errors';
import { validateRegisterForm, type RegisterForm } from '../../src/domain/account';
import { useRegister } from '../../src/hooks/queries';
import { Button } from '../../src/ui/components/Button';
import { DemoBanner } from '../../src/ui/components/DemoBanner';
import { Field } from '../../src/ui/components/Field';
import { Screen } from '../../src/ui/components/Screen';
import { colors, radius, spacing, typography } from '../../src/ui/theme';

export default function RegisterScreen() {
  const [form, setForm] = useState<RegisterForm>({ first_name: '', last_name: '', email: '', password: '', confirm_password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterForm, string>>>({});
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const register = useRegister();

  const set = (patch: Partial<RegisterForm>) => setForm((f) => ({ ...f, ...patch }));

  const submit = () => {
    const validation = validateRegisterForm(form);
    setErrors(validation);
    setServerErrors([]);
    if (Object.keys(validation).length) return;
    register.mutate(
      { ...form, email: form.email.trim(), first_name: form.first_name.trim(), last_name: form.last_name.trim() },
      {
        onSuccess: (result) => {
          if (result.success) router.back();
          else setServerErrors(result.errors ?? ['Registration failed']);
        },
        onError: (e) => setServerErrors([describeError(e)]),
      },
    );
  };

  return (
    <Screen>
      <DemoBanner />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={typography.title}>Create account</Text>
          <Field label="First name" value={form.first_name} onChangeText={(v) => set({ first_name: v })} error={errors.first_name} autoComplete="given-name" testID="reg-first-name" />
          <Field label="Last name" value={form.last_name} onChangeText={(v) => set({ last_name: v })} error={errors.last_name} autoComplete="family-name" testID="reg-last-name" />
          <Field label="Email" value={form.email} onChangeText={(v) => set({ email: v })} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="reg-email" />
          <Field label="Password" value={form.password} onChangeText={(v) => set({ password: v })} error={errors.password} secureTextEntry autoComplete="new-password" testID="reg-password" />
          <Field label="Confirm password" value={form.confirm_password} onChangeText={(v) => set({ confirm_password: v })} error={errors.confirm_password} secureTextEntry autoComplete="new-password" testID="reg-confirm" />
          {serverErrors.map((e) => (
            <Text key={e} style={styles.error}>
              {e}
            </Text>
          ))}
          <Button title="Create account" onPress={submit} loading={register.isPending} testID="register-submit" />
          <Link href="/auth/login" replace style={styles.link}>
            Already have an account? Sign in
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.sm },
  error: { color: colors.danger },
  link: { color: colors.primaryDark, fontWeight: '600', textAlign: 'center', marginTop: spacing.sm },
});
