import { renderHook, waitFor } from '@testing-library/react-native';
import type { StoreApi, StoredSession } from '../../src/api';
import { useRestoreSession } from '../../src/hooks/useRestoreSession';
import { useSession } from '../../src/state/session';

function fakeApi(restore: () => Promise<StoredSession>): StoreApi {
  return { restoreSession: jest.fn(restore), getGuestToken: jest.fn() } as unknown as StoreApi;
}

describe('useRestoreSession', () => {
  beforeEach(() => useSession.setState({ customer: null }));

  it('restores a returning customer instead of minting a guest token', async () => {
    const api = fakeApi(async () => ({ token: 'jwt', customer_id: 5, username: 'ada@example.com' }));
    await renderHook(() => useRestoreSession(api));

    await waitFor(() => expect(useSession.getState().customer).toEqual({ customerId: 5, username: 'ada@example.com' }));
    expect(api.getGuestToken).not.toHaveBeenCalled();
  });

  it('does not overwrite a sign-in that finished before a slow restore', async () => {
    let resolve: (s: StoredSession) => void = () => undefined;
    const api = fakeApi(() => new Promise((r) => (resolve = r)));
    await renderHook(() => useRestoreSession(api));

    useSession.getState().setCustomer({ customerId: 5, username: 'ada@example.com' });
    resolve({ token: 'guest', customer_id: 9, username: null });

    await waitFor(() => expect(api.restoreSession).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(useSession.getState().customer).toEqual({ customerId: 5, username: 'ada@example.com' });
  });
});
