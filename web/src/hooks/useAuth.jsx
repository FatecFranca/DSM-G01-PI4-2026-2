import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, definirAoExpirar, lerToken, limparToken, salvarToken } from '../services/api.js';

const AuthContext = createContext(null);

// a sessão só vale se o servidor confirmar em GET /api/auth/me; só ter o token guardado não basta
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const revalidar = useCallback(async () => {
    if (!lerToken()) return setUsuario(null);
    try {
      const { usuario: u } = await api('/auth/me');
      setUsuario(u);
    } catch (e) {
      if (e.status === 401) setUsuario(null);
      // erro de rede: mantém o estado atual em vez de deslogar
    }
  }, []);

  useEffect(() => {
    definirAoExpirar(() => setUsuario(null));
    revalidar().finally(() => setCarregando(false));
  }, [revalidar]);

  const entrar = useCallback(async (identificador, senha, lembrar) => {
    const r = await api('/auth/login', { metodo: 'POST', corpo: { identificador, senha } });
    salvarToken(r.token, lembrar);
    setUsuario(r.usuario);
  }, []);

  const registrar = useCallback((dados) => api('/auth/register', { metodo: 'POST', corpo: dados }), []);

  const sair = useCallback(() => {
    limparToken();
    setUsuario(null);
  }, []);

  const valor = useMemo(
    () => ({ usuario, carregando, entrar, registrar, sair, revalidar }),
    [usuario, carregando, entrar, registrar, sair, revalidar]
  );
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
