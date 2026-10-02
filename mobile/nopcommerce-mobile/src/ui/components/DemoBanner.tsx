import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSettings } from '../../state/settings';
import { colors, spacing } from '../theme';

/** Shown on every screen while the app runs against bundled fixtures. */
export function DemoBanner() {
  const demoMode = useSettings((s) => s.demoMode);
  if (!demoMode) return null;
  return (
    <View style={styles.banner} testID="demo-banner">
      <Text style={styles.text}>Demo mode: sample data, no real store. </Text>
      <Link href="/settings" style={styles.link}>
        Connect a store
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.demoBanner,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  text: { color: colors.demoBannerText, fontSize: 12 },
  link: { color: colors.demoBannerText, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
});
