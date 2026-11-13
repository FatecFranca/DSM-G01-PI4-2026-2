import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import CampoSenha from '../components/CampoSenha.jsx';
import ForcaSenha from '../components/ForcaSenha.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../services/api.js';
import { validadores } from '../utils/validacao.js';

const VAZIO = { organizacao: '', codigoConvite: '', nome: '', usuario: '', email: '', senha: '', confirmar: '' };
const COMUNS = ['nome', 'usuario', 'email', 'senha', 'confirmar'];

export default function Cadastro() {
  const { registrar } = useAuth();
  const navegar = useNavigate();

  const [params] = useSearchParams(); // /cadastro?convite=xxxxx-xxxxx já abre no modo convite
  const conviteDaUrl = params.get('convite') ?? '';
  const [modo, setModo] = useState(conviteDaUrl ? 'convite' : 'empresa');
  const [previa, setPrevia] = useState(null); // { organizacao, papel } do convite
  const [v, setV] = useState({ ...VAZIO, codigoConvite: conviteDaUrl });
  const [tocados, setTocados] = useState({});
  const [msgs, setMsgs] = useState({}); // erros por campo (local ou do servidor)
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const classe = (k) => (msgs[k] ? 'invalido' : tocados[k] && v[k] ? 'valido' : '');

  function validarLocal(k, valores = v) {
    const msg = validadores[k](valores[k], valores);
    setMsgs((m) => ({ ...m, [k]: msg }));
    return !msg;
  }

  // pergunta ao servidor se usuário/e-mail estão livres
  async function checarDisponibilidade(k) {
    try {
      const r = await api('/auth/disponibilidade', { query: { [k]: v[k].trim() } });
      if (r[k] === false) {
        setMsgs((m) => ({ ...m, [k]: k === 'usuario' ? 'Este usuário já está em uso.' : 'Este e-mail já está cadastrado.' }));
      }
    } catch { /* sem rede: o cadastro final ainda valida no servidor */ }
  }

  function aoMudar(k, valor) {
    const novo = { ...v, [k]: valor };
    setV(novo);
    if (tocados[k]) validarLocal(k, novo);
    if (k === 'senha' && tocados.confirmar) validarLocal('confirmar', novo);
  }

  async function aoSair(k) {
    if (!v[k] && !tocados[k]) return;
    setTocados((t) => ({ ...t, [k]: true }));
    if (validarLocal(k) && (k === 'usuario' || k === 'email')) checarDisponibilidade(k);
  }

  // pergunta ao servidor de qual empresa é o convite, sem consumi-lo
  async function conferirConvite(codigo = v.codigoConvite) {
    setPrevia(null);
    if (validadores.codigoConvite(codigo)) return;
    try {
      setPrevia(await api(`/auth/convite/${encodeURIComponent(codigo.trim())}`));
      setMsgs((m) => ({ ...m, codigoConvite: '' }));
    } catch (err) {
      setMsgs((m) => ({ ...m, codigoConvite: err.campos?.codigoConvite ?? err.message }));
    }
  }

  useEffect(() => { if (conviteDaUrl) conferirConvite(conviteDaUrl); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function trocarModo(novo) {
    setModo(novo);
    setErro('');
    setMsgs({});
    setPrevia(null);
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');

    const chaves = [modo === 'empresa' ? 'organizacao' : 'codigoConvite', ...COMUNS];
    setTocados(Object.fromEntries(chaves.map((k) => [k, true])));
    const invalidos = chaves.filter((k) => !validarLocal(k));
    if (invalidos.length) return document.getElementById(invalidos[0])?.focus();

    setEnviando(true);
    try {
      await registrar({
        ...(modo === 'empresa' ? { organizacao: v.organizacao.trim() } : { codigoConvite: v.codigoConvite.trim() }),
        nome: v.nome.trim(), usuario: v.usuario.trim(), email: v.email.trim(), senha: v.senha,
      });
      navegar('/login', { replace: true, state: { entrada: 'esquerda', cadastrado: true } });
    } catch (err) {
      if (err.campos && Object.keys(err.campos).length) setMsgs((m) => ({ ...m, ...err.campos }));
      setErro(err.message);
      setEnviando(false);
    }
  }

  const campoTexto = (k, rotulo, extra = {}) => (
    <div className="campo">
      <label htmlFor={k}>{rotulo}</label>
      <input id={k} type="text" value={v[k]} className={classe(k)} required
             aria-describedby={`msg-${k}`} aria-invalid={!!msgs[k]}
             onChange={(e) => aoMudar(k, e.target.value)} onBlur={() => aoSair(k)} {...extra} />
      <small className="msg" id={`msg-${k}`} aria-live="polite">{msgs[k]}</small>
    </div>
  );

  return (
    <AuthLayout invertido>
      <form className="form form-cadastro" onSubmit={enviar} noValidate>
        <h2>Crie sua conta</h2>

        <div className="modos" role="tablist" aria-label="Tipo de cadastro">
          <button type="button" role="tab" aria-selected={modo === 'empresa'} className={modo === 'empresa' ? 'ativo' : ''} onClick={() => trocarModo('empresa')}>Criar uma empresa</button>
          <button type="button" role="tab" aria-selected={modo === 'convite'} className={modo === 'convite' ? 'ativo' : ''} onClick={() => trocarModo('convite')}>Tenho um convite</button>
        </div>

        {modo === 'empresa'
          ? campoTexto('organizacao', 'Nome da empresa', { autoComplete: 'organization', maxLength: 80 })
          : (
            <>
              {campoTexto('codigoConvite', 'Código de convite', { autoCapitalize: 'characters', spellCheck: false, maxLength: 20, onBlur: () => { aoSair('codigoConvite'); conferirConvite(); } })}
              {previa && <small className="msg ok" role="status">Você vai entrar em <b>{previa.organizacao}</b> como {previa.papel}.</small>}
            </>
          )}

        <div className="linha">
          {campoTexto('nome', 'Nome completo', { autoComplete: 'name' })}
          {campoTexto('usuario', 'Usuário', { autoComplete: 'username', autoCapitalize: 'none', spellCheck: false, maxLength: 20 })}
        </div>

        {campoTexto('email', 'E-mail', { type: 'email', autoComplete: 'email', autoCapitalize: 'none', spellCheck: false })}

        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <CampoSenha id="senha" valor={v.senha} aoMudar={(x) => aoMudar('senha', x)} aoSair={() => aoSair('senha')}
                      autoComplete="new-password" classe={classe('senha')} descrito="msg-senha" />
          <ForcaSenha senha={v.senha} />
          <small className="msg" id="msg-senha" aria-live="polite">{msgs.senha}</small>
        </div>

        <div className="campo">
          <label htmlFor="confirmar">Confirmar senha</label>
          <CampoSenha id="confirmar" valor={v.confirmar} aoMudar={(x) => aoMudar('confirmar', x)} aoSair={() => aoSair('confirmar')}
                      autoComplete="new-password" classe={classe('confirmar')} descrito="msg-confirmar" />
          <small className="msg" id="msg-confirmar" aria-live="polite">{msgs.confirmar}</small>
        </div>

        {erro && <p className="erro" role="alert">{erro}</p>}

        <button type="submit" className="btn btn-solido" disabled={enviando}>
          {enviando ? 'Criando...' : 'Criar conta'}
        </button>

        <p className="troca">Já tem conta? <Link to="/login" state={{ entrada: 'esquerda' }}>Entrar</Link></p>
      </form>
    </AuthLayout>
  );
}
