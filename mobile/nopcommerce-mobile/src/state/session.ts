import { create } from 'zustand';

export interface SessionCustomer {
  customerId: number;
  username: string | null;
}

interface SessionState {
  /** Null while unknown; a guest session has `username === null`. */
  customer: SessionCustomer | null;
  setCustomer(customer: SessionCustomer | null): void;
  isSignedIn(): boolean;
}

export const useSession = create<SessionState>()((set, get) => ({
  customer: null,
  setCustomer: (customer) => set({ customer }),
  isSignedIn: () => Boolean(get().customer?.username),
}));
