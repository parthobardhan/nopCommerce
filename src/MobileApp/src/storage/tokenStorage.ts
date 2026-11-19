import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'nop_mobile_api_token';

export const tokenStorage = {
  load: (): Promise<string | null> => SecureStore.getItemAsync(TOKEN_KEY),
  save: (token: string): Promise<void> => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: (): Promise<void> => SecureStore.deleteItemAsync(TOKEN_KEY),
};
