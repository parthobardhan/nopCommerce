import { createContext, useContext } from 'react';
import type { StoreSettings } from '../domain/settings';
import { DemoStoreApi } from './demo/demoStoreApi';
import { HttpStoreApi } from './httpStoreApi';
import type { StoreApi } from './storeApi';
import { MemoryTokenStorage, SecureTokenStorage } from './tokenStorage';

export type { StoreApi } from './storeApi';
export { ApiError, describeError } from './errors';

export function createStoreApi(settings: StoreSettings): StoreApi {
  if (settings.demoMode) return new DemoStoreApi({ tokenStorage: new MemoryTokenStorage() });
  return new HttpStoreApi({ baseUrl: settings.baseUrl, tokenStorage: new SecureTokenStorage(settings.baseUrl) });
}

export const StoreApiContext = createContext<StoreApi | null>(null);

export function useStoreApi(): StoreApi {
  const api = useContext(StoreApiContext);
  if (!api) throw new Error('useStoreApi must be used inside <StoreApiContext.Provider>');
  return api;
}
