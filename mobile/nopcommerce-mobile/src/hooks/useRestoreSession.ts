import { useEffect } from 'react';
import type { StoreApi } from '../api';
import { useSession } from '../state/session';

/**
 * Resumes the stored session for `api` on mount (and whenever the store changes).
 * A sign-in that completes first wins over a slower restore.
 */
export function useRestoreSession(api: StoreApi): void {
  useEffect(() => {
    const { setCustomer } = useSession.getState();
    setCustomer(null);
    let cancelled = false;
    api
      .restoreSession()
      .then((session) => {
        if (cancelled || useSession.getState().customer) return;
        setCustomer({ customerId: session.customer_id, username: session.username });
      })
      .catch(() => {
        // Screens surface the connection error through their own queries.
      });
    return () => {
      cancelled = true;
    };
  }, [api]);
}
