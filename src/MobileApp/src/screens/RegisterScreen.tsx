import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '../components/Button';
import { ErrorList } from '../components/StateViews';
import { TextField } from '../components/TextField';
import { useSession } from '../context/SessionContext';
import { colors, spacing } from '../theme';
import { validateRegistration } from '../utils/validation';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useSession();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const submit = async () => {
    const validation = validateRegistration(form);
    if (validation.length) {
      setErrors(validation);
      return;
    }
    setBusy(true);
    const result = await register({
      email: form.email.trim(),
      password: form.password,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
    });
    setBusy(false);
    setErrors(result);
    if (!result.length) router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="register-screen">
      <Text style={styles.title}>Create your account</Text>
      <ErrorList errors={errors} />
      <TextField label="First name" value={form.firstName} onChangeText={(firstName) => update({ firstName })} testID="register-first-name" />
      <TextField label="Last name" value={form.lastName} onChangeText={(lastName) => update({ lastName })} testID="register-last-name" />
      <TextField
        label="Email"
        value={form.email}
        onChangeText={(email) => update({ email })}
        keyboardType="email-address"
        autoCapitalize="none"
        testID="register-email"
      />
      <TextField label="Password" value={form.password} onChangeText={(password) => update({ password })} secureTextEntry testID="register-password" />
      <TextField
        label="Confirm password"
        value={form.confirmPassword}
        onChangeText={(confirmPassword) => update({ confirmPassword })}
        secureTextEntry
        testID="register-confirm-password"
      />
      <Button title="Register" onPress={submit} loading={busy} testID="register-submit" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, backgroundColor: colors.background, flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
});
