import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, tenant: null, ready: !getToken() });

  const logout = useCallback(() => {
    setToken(null);
    setState({ user: null, tenant: null, ready: true });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (getToken()) {
      api.me().then((r) => setState({ user: r.user, tenant: r.tenant, ready: true })).catch(logout);
    }
  }, [logout]);

  const login = async (email, password) => {
    const r = await api.login(email, password);
    setToken(r.token);
    setState({ user: r.user, tenant: r.tenant, ready: true });
    return r;
  };
  const refreshTenant = async () => {
    const r = await api.me();
    setState((s) => ({ ...s, tenant: r.tenant }));
  };

  return <AuthContext.Provider value={{ ...state, login, logout, refreshTenant }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
