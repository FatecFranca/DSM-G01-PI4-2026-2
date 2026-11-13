import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Cadastro from './pages/Cadastro.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Historico from './pages/Historico.jsx';
import Configuracoes from './pages/Configuracoes.jsx';
import Equipe from './pages/Equipe.jsx';
import Pedidos from './pages/Pedidos.jsx';
import { useAuth } from './hooks/useAuth.jsx';

/** Só o dono entra; a API também recusa (403) mesmo que alguém force a URL. */
function SomenteDono({ children }) {
  const { usuario } = useAuth();
  return usuario?.papel === 'dono' ? children : <Navigate to="/app/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
      </Route>

      {/* Tudo em /app só abre se o servidor confirmar a sessão */}
      <Route path="/app" element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="historico" element={<Historico />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="equipe" element={<SomenteDono><Equipe /></SomenteDono>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
