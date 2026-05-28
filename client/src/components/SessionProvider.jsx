import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const SessionContext = createContext(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState({
    loading: true,
    authenticated: false,
    isAdmin: false,
    role: null,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/session', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      setSession({
        loading: false,
        authenticated: !!data.authenticated,
        isAdmin: !!(data.authenticated && data.role === 'admin'),
        role: data.role || null,
      });
    } catch {
      setSession({ loading: false, authenticated: false, isAdmin: false, role: null });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch('/api/auth', { method: 'DELETE', credentials: 'include' });
    setSession({ loading: false, authenticated: false, isAdmin: false, role: null });
  }, []);

  const value = useMemo(
    () => ({ ...session, refresh, logout }),
    [session, refresh, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
