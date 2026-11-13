import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS, type StoreSettings } from '../domain/settings';

interface SettingsState extends StoreSettings {
  hydrated: boolean;
  setBaseUrl(url: string): void;
  setDemoMode(enabled: boolean): void;
  markHydrated(): void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      hydrated: false,
      setBaseUrl: (baseUrl) => set({ baseUrl }),
      setDemoMode: (demoMode) => set({ demoMode }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'nop.settings',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ baseUrl: s.baseUrl, demoMode: s.demoMode }),
      onRehydrateStorage: () => (state) => state?.markHydrated(),
    },
  ),
);
