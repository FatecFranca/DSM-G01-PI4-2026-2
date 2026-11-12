import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, carregarTokenSalvo, definirAoExpirar, limparToken, salvarToken } from '../services/api';

const AuthContext = createContext(null);

/** Ao abrir o app, o token salvo só vale se o servidor responder OK em GET /api/auth/me. */
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    definirAoExpirar(() => setUsuario(null));
    (async () => {
      try {
        if (await carregarTokenSalvo()) {
          const { usuario: u } = await api('/auth/me');
          setUsuario(u);
        }
      } catch {
        /* 401 já limpou o token; erro de rede deixa o usuário no login */
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const entrar = useCallback(async ({ identificador, senha, lembrar }) => {
    const r = await api('/auth/login', { metodo: 'POST', corpo: { identificador, senha } });
    await salvarToken(r.token, lembrar);
    setUsuario(r.usuario);
  }, []);

  const registrar = useCallback((dados) => api('/auth/register', { metodo: 'POST', corpo: dados }), []);

  const sair = useCallback(async () => {
    await limparToken();
    setUsuario(null);
  }, []);

  const valor = useMemo(() => ({ usuario, carregando, entrar, registrar, sair }), [usuario, carregando, entrar, registrar, sair]);
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
