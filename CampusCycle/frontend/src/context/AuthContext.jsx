import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../services';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // initial session hydration

  // On first load, if we have a token, try to restore the session.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const token = authApi.getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        authApi.clearToken();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user: loggedIn } = await authApi.login(email, password);
    authApi.setToken(token);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const register = useCallback(async (payload) => {
    const { token, user: created } = await authApi.register(payload);
    authApi.setToken(token);
    setUser(created);
    return created;
  }, []);

  const logout = useCallback(() => {
    authApi.clearToken();
    setUser(null);
  }, []);

  const value = { user, loading, login, register, logout, setUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
