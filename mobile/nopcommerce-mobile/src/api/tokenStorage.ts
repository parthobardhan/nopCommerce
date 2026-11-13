import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { StoredSession, TokenStorage } from './storeApi';

const KEY = 'nop.store.token';

/** Keeps a token in memory only; used for demo mode and as the web fallback. */
export class MemoryTokenStorage implements TokenStorage {
  private session: StoredSession | null = null;
  async get(): Promise<StoredSession | null> {
    return this.session;
  }
  async set(session: StoredSession | null): Promise<void> {
    this.session = session;
  }
}

/** Stores the bearer token in the platform keychain/keystore (native only). */
export class SecureTokenStorage implements TokenStorage {
  private readonly key: string;
  constructor(scope: string) {
    this.key = `${KEY}.${scope.replace(/[^A-Za-z0-9._-]/g, '_')}`;
  }
  async get(): Promise<StoredSession | null> {
    return parseStoredSession(await SecureStore.getItemAsync(this.key));
  }
  async set(session: StoredSession | null): Promise<void> {
    if (session) await SecureStore.setItemAsync(this.key, JSON.stringify(session));
    else await SecureStore.deleteItemAsync(this.key);
  }
}

/** expo-secure-store has no web backend, so web keeps the token for the page session only. */
export function createTokenStorage(scope: string, platform: string = Platform.OS): TokenStorage {
  return platform === 'web' ? new MemoryTokenStorage() : new SecureTokenStorage(scope);
}

export function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof value.token === 'string' && value.token) {
      return { token: value.token, customer_id: Number(value.customer_id) || 0, username: typeof value.username === 'string' && value.username ? value.username : null };
    }
  } catch {
    // Builds before the session envelope stored the bare JWT.
  }
  return { token: raw, customer_id: 0, username: null };
}
