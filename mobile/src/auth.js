import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, initApi, setToken, setUnauthorizedHandler } from './api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, tenant: null, ready: false });
  const logout = useCallback(async () => { await setToken(null); setState({ user: null, tenant: null, ready: true }); }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    (async () => {
      const has = await initApi();
      if (!has) return setState({ user: null, tenant: null, ready: true });
      try { const r = await api.me(); setState({ user: r.user, tenant: r.tenant, ready: true }); }
      catch (e) { if (e.code === 'NETWORK') setState({ user: { name: '…', role: 'operator' }, tenant: { name: '' }, ready: true }); else logout(); }
    })();
  }, [logout]);

  const login = async (email, password) => {
    const r = await api.login(email, password);
    await setToken(r.token);
    setState({ user: r.user, tenant: r.tenant, ready: true });
  };
  return <Ctx.Provider value={{ ...state, login, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
