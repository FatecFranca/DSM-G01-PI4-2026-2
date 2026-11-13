import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import Logo from './Logo.jsx';
import '../styles/app.css';

export default function AppLayout() {
  const { usuario, sair } = useAuth();
  const navegar = useNavigate();

  return (
    <>
      <header className="app-topo">
        <div className="container app-topo-in">
          <span className="logo logo-sm"><Logo /></span>
          <span className="app-org" title="Sua organização">{usuario.organizacao?.nome}</span>
          <nav className="app-nav" aria-label="Principal">
            <NavLink to="/app/dashboard" className={({ isActive }) => (isActive ? 'ativo' : '')}>Dashboard</NavLink>
            <NavLink to="/app/pedidos" className={({ isActive }) => (isActive ? 'ativo' : '')}>Pedidos</NavLink>
            <NavLink to="/app/historico" className={({ isActive }) => (isActive ? 'ativo' : '')}>Histórico</NavLink>
            <NavLink to="/app/configuracoes" className={({ isActive }) => (isActive ? 'ativo' : '')}>Configurações</NavLink>
            {usuario.papel === 'dono' && (
              <NavLink to="/app/equipe" className={({ isActive }) => (isActive ? 'ativo' : '')}>Equipe</NavLink>
            )}
          </nav>
          <div className="app-usuario">
            <span>{usuario.nome}</span>
            <button className="btn btn-contorno btn-sm" onClick={() => { sair(); navegar('/login'); }}>Sair</button>
          </div>
        </div>
      </header>
      <main className="container app-main"><Outlet /></main>
    </>
  );
}
