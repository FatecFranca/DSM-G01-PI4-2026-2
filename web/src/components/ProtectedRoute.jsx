import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

/** Rota protegida: confirma a sessão no servidor (get /api/auth/me) a cada navegação. */
export function ProtectedRoute() {
  const { usuario, carregando, revalidar } = useAuth();
  const local = useLocation();

  useEffect(() => {
    if (!carregando) revalidar();
  }, [local.pathname, carregando, revalidar]);

  if (carregando) return <div className="tela-cheia">Verificando sessão...</div>;
  if (!usuario) return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  return <Outlet />;
}

/** Login/cadastro: quem já tem sessão válida vai direto ao dashboard. */
export function PublicOnlyRoute() {
  const { usuario, carregando } = useAuth();
  if (carregando) return <div className="tela-cheia">Carregando...</div>;
  if (usuario) return <Navigate to="/app/dashboard" replace />;
  return <Outlet />;
}
