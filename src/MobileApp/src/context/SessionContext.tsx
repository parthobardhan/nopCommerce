import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiClient } from '../api/client';
import type { Customer, Session } from '../api/types';
import { getApiUrl } from '../config';
import { tokenStorage } from '../storage/tokenStorage';

export interface SessionContextValue {
  api: ApiClient;
  customer: Customer | null;
  ready: boolean;
  error: string | null;
  isRegistered: boolean;
  /** @returns validation errors; empty on success */
  login: (email: string, password: string) => Promise<string[]>;
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<string[]>;
  logout: () => Promise<void>;
  retry: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Holds the current token outside React state so the API client always sends the latest one */
class TokenHolder {
  private token: string | null = null;
  get = () => this.token;
  set = (token: string | null) => {
    this.token = token;
  };
}

interface SessionProviderProps {
  children: React.ReactNode;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function SessionProvider({ children, baseUrl, fetchImpl }: SessionProviderProps) {
  const [tokens] = useState(() => new TokenHolder());
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const apply = useCallback(async (session: Session) => {
    tokens.set(session.token);
    await tokenStorage.save(session.token);
    setCustomer(session.customer);
  }, [tokens]);

  const api = useMemo(() => {
    const client: ApiClient = new ApiClient({
      baseUrl: baseUrl ?? getApiUrl(),
      fetchImpl,
      getToken: tokens.get,
      onUnauthorized: async () => {
        // the token was revoked or the customer was deleted: continue as a fresh guest
        tokens.set(null);
        const session = await client.createSession();
        await apply(session);
        return session.token;
      },
    });
    return client;
  }, [baseUrl, fetchImpl, apply, tokens]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setError(null);
      try {
        const stored = await tokenStorage.load();
        if (stored) {
          tokens.set(stored);
          const current = await api.getCustomer();
          if (!cancelled) setCustomer(current);
        } else {
          const session = await api.createSession();
          if (!cancelled) await apply(session);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, apply, attempt, tokens]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.login(email, password);
      if (!result.success || !result.session) return result.errors.length ? result.errors : ['Login failed'];
      await apply(result.session);
      return [];
    },
    [api, apply],
  );

  const register = useCallback(
    async (data: { email: string; password: string; firstName: string; lastName: string }) => {
      const result = await api.register(data);
      if (!result.success) return result.errors.length ? result.errors : ['Registration failed'];
      if (!result.session) {
        // the store requires e-mail validation or admin approval; continue as a new guest
        await apply(await api.createSession());
        return result.errors;
      }
      await apply(result.session);
      return [];
    },
    [api, apply],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      tokens.set(null);
      await tokenStorage.clear();
      await apply(await api.createSession());
    }
  }, [api, apply, tokens]);

  const retry = useCallback(() => {
    setReady(false);
    setAttempt((value) => value + 1);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      api,
      customer,
      ready,
      error,
      isRegistered: !!customer && !customer.isGuest,
      login,
      register,
      logout,
      retry,
    }),
    [api, customer, ready, error, login, register, logout, retry],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used within a SessionProvider');
  return value;
}

export function useApi(): ApiClient {
  return useSession().api;
}
