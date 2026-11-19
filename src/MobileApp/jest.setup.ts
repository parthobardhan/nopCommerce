jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('expo-router', () => jest.requireActual('./test/expoRouterMock'));

beforeEach(() => {
  const secureStore = jest.requireMock('expo-secure-store') as { __store: Map<string, string> };
  secureStore.__store.clear();
  const { resetRouter } = jest.requireActual('./test/expoRouterMock') as typeof import('./test/expoRouterMock');
  resetRouter();
});
