import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useCart } from '../../src/hooks/queries';
import { summarizeCart } from '../../src/domain/cart';
import { colors } from '../../src/ui/theme';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={[styles.icon, focused && styles.iconFocused]}>{glyph}</Text>;
}

function CartIcon({ focused }: { focused: boolean }) {
  const cart = useCart();
  const count = cart.data ? summarizeCart(cart.data.items).itemCount : 0;
  return (
    <View>
      <TabIcon glyph="🛒" focused={focused} />
      {count > 0 ? (
        <View style={styles.badge} testID="cart-badge">
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} /> }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: ({ focused }) => <TabIcon glyph="🔍" focused={focused} /> }} />
      <Tabs.Screen name="cart" options={{ title: 'Cart', tabBarIcon: ({ focused }) => <CartIcon focused={focused} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ focused }) => <TabIcon glyph="👤" focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 20, opacity: 0.6 },
  iconFocused: { opacity: 1 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.primaryText, fontSize: 11, fontWeight: '700' },
});
