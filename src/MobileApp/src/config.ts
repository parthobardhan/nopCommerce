import Constants from 'expo-constants';

const DEFAULT_API_URL = 'http://10.0.2.2:5000';

/**
 * Base URL of the nopCommerce store. 10.0.2.2 is the host machine as seen from the Android emulator.
 * Override with EXPO_PUBLIC_API_URL or `expo.extra.apiUrl` in app.json.
 */
export function getApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const fromConfig = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  return (fromEnv || fromConfig || DEFAULT_API_URL).replace(/\/+$/, '');
}
