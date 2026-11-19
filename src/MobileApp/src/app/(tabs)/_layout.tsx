import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';

import { useCart } from '../../context/CartContext';
import { colors } from '../../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return <Ionicons name={name} color={color as string} size={size} />;
}

export default function TabsLayout() {
  const { itemCount } = useCart();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: '#fff',
        tabBarActiveTintColor: colors.primaryDark,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Shop', tabBarIcon: (props) => <TabIcon name="storefront-outline" {...props} /> }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: 'Search', tabBarIcon: (props) => <TabIcon name="search-outline" {...props} /> }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: (props) => <TabIcon name="cart-outline" {...props} />,
          tabBarBadge: itemCount ? itemCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent },
          tabBarButtonTestID: 'tab-cart',
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: (props) => <TabIcon name="person-outline" {...props} /> }}
      />
    </Tabs>
  );
}
