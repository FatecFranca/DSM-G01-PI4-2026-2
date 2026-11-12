import { useLocation } from 'react-router-dom';
import Logo from './Logo.jsx';
import '../styles/auth.css';

/** Card de duas colunas usado em Login e Cadastro. `invertido` põe a imagem à esquerda. */
export default function AuthLayout({ invertido = false, children }) {
  const { state } = useLocation();
  return (
    <div className="auth-body">
      <main className={`card${invertido ? ' invertido' : ''}`} data-entrada={state?.entrada}>
        <section className="painel-login">
          <h1 className="logo logo-grande" aria-label="Paraflow"><Logo /></h1>
          {children}
        </section>
        <section className="painel-ilustracao" aria-hidden="true" />
      </main>
    </div>
  );
}
