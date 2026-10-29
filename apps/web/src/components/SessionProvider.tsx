'use client';

import { createContext, useContext } from 'react';
import type { Me, Permission } from '@/lib/types';

interface Session {
  user: Me;
  /** UI convenience only — the API enforces permissions on every request. */
  can: (permission: Permission) => boolean;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ user, children }: { user: Me; children: React.ReactNode }) {
  const can = (p: Permission) => user.permissions.includes(p);
  return <SessionContext.Provider value={{ user, can }}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
