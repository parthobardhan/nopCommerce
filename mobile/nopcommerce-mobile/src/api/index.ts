import { createContext, useContext } from 'react';
import type { StoreSettings } from '../domain/settings';
import { DemoStoreApi } from './demo/demoStoreApi';
import { HttpStoreApi } from './httpStoreApi';
import type { StoreApi, StoredSession } from './storeApi';
import { createTokenStorage, MemoryTokenStorage } from './tokenStorage';

export type { StoreApi, StoredSession } from './storeApi';
export { ApiError, describeError } from './errors';

export interface StoreApiCallbacks {
  /** A customer token was rejected and replaced by a guest session. */
  onSessionExpired?: (guest: StoredSession) => void;
}

export function createStoreApi(settings: StoreSettings, callbacks: StoreApiCallbacks = {}): StoreApi {
  if (settings.demoMode) return new DemoStoreApi({ tokenStorage: new MemoryTokenStorage() });
  return new HttpStoreApi({ baseUrl: settings.baseUrl, tokenStorage: createTokenStorage(settings.baseUrl), onSessionExpired: callbacks.onSessionExpired });
}

export const StoreApiContext = createContext<StoreApi | null>(null);

export function useStoreApi(): StoreApi {
  const api = useContext(StoreApiContext);
  if (!api) throw new Error('useStoreApi must be used inside <StoreApiContext.Provider>');
  return api;
}
