import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import CampoSenha from '../components/CampoSenha.jsx';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Login() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const { state } = useLocation();

  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    if (!identificador.trim() || !senha) return setErro('Preencha usuário e senha.');

    setEnviando(true);
    try {
      await entrar(identificador.trim(), senha, lembrar);
      navegar(state?.de?.startsWith('/app') ? state.de : '/app/dashboard', { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout>
      <form className="form" onSubmit={enviar} noValidate>
        <h2>Olá, seja bem-vindo</h2>

        <div className="campo">
          <label htmlFor="identificador">Usuário ou e-mail</label>
          <input id="identificador" type="text" autoComplete="username" autoCapitalize="none"
                 value={identificador} onChange={(e) => setIdentificador(e.target.value)} required />
        </div>

        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <CampoSenha id="senha" valor={senha} aoMudar={setSenha} autoComplete="current-password" />
        </div>

        {erro && <p className="erro" role="alert">{erro}</p>}
        {state?.cadastrado && !erro && <p className="sucesso" role="status">Conta criada! Entre para continuar.</p>}

        <div className="opcoes">
          <label className="lembrar">
            <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
            Lembrar de mim
          </label>
          {/* TODO(backlog): recuperação de senha (POST /api/auth/esqueci) */}
        </div>

        <button type="submit" className="btn btn-solido" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="divisor"><span>ou</span></div>

        <Link to="/cadastro" state={{ entrada: 'direita' }} className="btn btn-contorno">Cadastrar</Link>
      </form>
    </AuthLayout>
  );
}
