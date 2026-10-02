import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { TokenStorage } from './storeApi';

const KEY = 'nop.store.token';

/** Keeps a token in memory only; used for demo mode and as a web fallback. */
export class MemoryTokenStorage implements TokenStorage {
  private token: string | null = null;
  async get(): Promise<string | null> {
    return this.token;
  }
  async set(token: string | null): Promise<void> {
    this.token = token;
  }
}

/** Stores the bearer token in the platform keychain/keystore. */
export class SecureTokenStorage implements TokenStorage {
  private readonly key: string;
  constructor(scope: string) {
    this.key = `${KEY}.${scope.replace(/[^A-Za-z0-9._-]/g, '_')}`;
  }
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    return SecureStore.getItemAsync(this.key);
  }
  async set(token: string | null): Promise<void> {
    if (Platform.OS === 'web') return;
    if (token) await SecureStore.setItemAsync(this.key, token);
    else await SecureStore.deleteItemAsync(this.key);
  }
}
