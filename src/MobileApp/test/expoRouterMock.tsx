import React, { useEffect } from 'react';
import { Text, View } from 'react-native';

export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

let params: Record<string, string> = {};

export function setParams(next: Record<string, string>) {
  params = next;
}

export function resetRouter() {
  router.push.mockReset();
  router.replace.mockReset();
  router.back.mockReset();
  params = {};
}

export const useRouter = () => router;
export const useLocalSearchParams = () => params;
export const useFocusEffect = (effect: () => void) => useEffect(effect, [effect]);

function Navigator({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

interface ScreenOptions {
  title?: string;
  tabBarBadge?: number;
  tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
}

/** Route declarations in layouts render a stub showing their options; in-screen option updates render nothing */
function Screen({ name, options }: { name?: string; options?: ScreenOptions }) {
  if (!name) return null;
  return (
    <View testID={`route-${name}`}>
      <Text>{options?.title ?? name}</Text>
      {options?.tabBarBadge ? <Text testID={`route-${name}-badge`}>{options.tabBarBadge}</Text> : null}
      {options?.tabBarIcon?.({ focused: false, color: '#000', size: 24 })}
    </View>
  );
}

export const Stack = Object.assign(Navigator, { Screen });
export const Tabs = Object.assign(Navigator, { Screen });
