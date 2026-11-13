import { router, Stack } from 'expo-router';
import { EmptyState, Screen } from '../src/ui/components/Screen';

export default function NotFoundScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Not found' }} />
      <EmptyState title="This page does not exist" action={{ title: 'Go home', onPress: () => router.replace('/') }} />
    </Screen>
  );
}
