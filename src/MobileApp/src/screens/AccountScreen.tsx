import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { ErrorList } from '../components/StateViews';
import { TextField } from '../components/TextField';
import { useSession } from '../context/SessionContext';
import { colors, radius, spacing } from '../theme';
import { validateLogin } from '../utils/validation';

function LoginForm() {
  const router = useRouter();
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const validation = validateLogin(email, password);
    if (validation.length) {
      setErrors(validation);
      return;
    }
    setBusy(true);
    setErrors(await login(email.trim(), password));
    setBusy(false);
  };

  return (
    <View testID="login-form">
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Your cart is kept when you sign in.</Text>
      <ErrorList errors={errors} />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        testID="login-email"
      />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry testID="login-password" />
      <Button title="Sign in" onPress={submit} loading={busy} testID="login-submit" />
      <View style={styles.divider} />
      <Text style={styles.subtitle}>New customer?</Text>
      <Button title="Create an account" variant="secondary" onPress={() => router.push('/register')} testID="go-register" />
    </View>
  );
}

function Profile() {
  const router = useRouter();
  const { customer, logout } = useSession();
  const [busy, setBusy] = useState(false);
  const name = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ');

  return (
    <View testID="profile">
      <View style={styles.card}>
        <Text style={styles.title}>{name || 'My account'}</Text>
        <Text style={styles.subtitle}>{customer?.email}</Text>
      </View>
      <Button title="My orders" variant="secondary" onPress={() => router.push('/orders')} testID="go-orders" style={styles.action} />
      <Button
        title="Sign out"
        variant="danger"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await logout();
          setBusy(false);
        }}
        testID="logout"
        style={styles.action}
      />
    </View>
  );
}

export default function AccountScreen() {
  const { isRegistered } = useSession();
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {isRegistered ? <Profile /> : <LoginForm />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, backgroundColor: colors.background, flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { color: colors.muted, marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg },
  action: { marginBottom: spacing.md },
});
