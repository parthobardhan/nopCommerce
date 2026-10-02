import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { HttpStoreApi } from '../src/api/httpStoreApi';
import { describeError } from '../src/api/errors';
import { MemoryTokenStorage } from '../src/api/tokenStorage';
import { normalizeStoreUrl } from '../src/domain/settings';
import { useSettings } from '../src/state/settings';
import { Button } from '../src/ui/components/Button';
import { Field } from '../src/ui/components/Field';
import { Screen } from '../src/ui/components/Screen';
import { colors, radius, spacing, typography } from '../src/ui/theme';

type CheckResult = { state: 'idle' } | { state: 'checking' } | { state: 'ok'; message: string } | { state: 'failed'; message: string };

export default function SettingsScreen() {
  const settings = useSettings();
  const [url, setUrl] = useState(settings.baseUrl);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [check, setCheck] = useState<CheckResult>({ state: 'idle' });

  const validated = () => {
    const result = normalizeStoreUrl(url);
    setUrlError(result.ok ? null : result.reason);
    return result;
  };

  const save = () => {
    const result = validated();
    if (!result.ok) return;
    setUrl(result.url);
    settings.setBaseUrl(result.url);
    setCheck({ state: 'idle' });
  };

  const testConnection = async () => {
    const result = validated();
    if (!result.ok) return;
    setCheck({ state: 'checking' });
    try {
      const probe = new HttpStoreApi({ baseUrl: result.url, tokenStorage: new MemoryTokenStorage(), timeoutMs: 10_000 });
      const token = await probe.getGuestToken();
      const categories = await probe.getHomepageCategories();
      setCheck({ state: 'ok', message: `Connected as guest #${token.customer_id}; ${categories.length} homepage categories.` });
    } catch (error) {
      setCheck({ state: 'failed', message: describeError(error) });
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.heading}>Demo mode</Text>
              <Text style={typography.caption}>Use bundled sample data. Nothing is sent to a real store.</Text>
            </View>
            <Switch value={settings.demoMode} onValueChange={settings.setDemoMode} trackColor={{ true: colors.primary }} testID="demo-switch" />
          </View>
        </View>

        <View style={[styles.card, settings.demoMode && styles.cardMuted]}>
          <Text style={typography.heading}>Live store</Text>
          <Text style={typography.caption}>Enter the root URL of a nopCommerce store that has the Web API Frontend plugin installed. The app calls {'<store>'}/api-frontend.</Text>
          <Field label="Store URL" value={url} onChangeText={setUrl} error={urlError ?? undefined} placeholder="https://shop.example.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" testID="store-url" />
          <View style={styles.row}>
            <Button title="Test connection" variant="secondary" onPress={testConnection} loading={check.state === 'checking'} style={{ flex: 1 }} testID="test-connection" />
            <Button title="Save" onPress={save} style={{ flex: 1 }} testID="save-url" />
          </View>
          {check.state === 'ok' ? <Text style={styles.ok}>{check.message}</Text> : null}
          {check.state === 'failed' ? <Text style={styles.failed}>{check.message}</Text> : null}
          {settings.demoMode ? <Text style={typography.caption}>Turn off demo mode to use this store.</Text> : null}
        </View>

        <Text style={styles.footer}>Tokens are kept in the device keychain and are never written to logs.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  cardMuted: { opacity: 0.85 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  ok: { color: colors.success },
  failed: { color: colors.danger },
  footer: { ...typography.caption, textAlign: 'center' },
});
