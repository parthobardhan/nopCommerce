import { createTokenStorage, MemoryTokenStorage, parseStoredSession, SecureTokenStorage } from '../../src/api/tokenStorage';

const SESSION = { token: 'jwt', customer_id: 5, username: 'ada@example.com' };

describe('createTokenStorage', () => {
  it('keeps tokens in memory on web, where secure store is unavailable', async () => {
    const storage = createTokenStorage('https://shop.example.com', 'web');
    expect(storage).toBeInstanceOf(MemoryTokenStorage);
    await storage.set(SESSION);
    expect(await storage.get()).toEqual(SESSION);
  });

  it('uses the keychain on native platforms', () => {
    expect(createTokenStorage('https://shop.example.com', 'ios')).toBeInstanceOf(SecureTokenStorage);
  });
});

describe('SecureTokenStorage', () => {
  it('round-trips the session and clears it', async () => {
    const storage = new SecureTokenStorage('https://shop.example.com');
    await storage.set(SESSION);
    expect(await storage.get()).toEqual(SESSION);
    await storage.set(null);
    expect(await storage.get()).toBeNull();
  });
});

describe('parseStoredSession', () => {
  it('treats a bare legacy JWT as a guest token', () => {
    expect(parseStoredSession('eyJhbGciOi.payload.sig')).toEqual({ token: 'eyJhbGciOi.payload.sig', customer_id: 0, username: null });
    expect(parseStoredSession(null)).toBeNull();
  });
});
