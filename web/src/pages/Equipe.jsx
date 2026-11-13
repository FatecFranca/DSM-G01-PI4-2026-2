import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../hooks/useAuth.jsx';

const fmtData = (iso) => new Date(iso).toLocaleDateString('pt-BR');
const NOVO = { nome: '', usuario: '', email: '', senha: '', papel: 'operador' };

export default function Equipe() {
  const { usuario } = useAuth();
  const [dados, setDados] = useState({ membros: [], convites: [] });
  const [convite, setConvite] = useState(null); // { codigo, link } (aparece uma vez)
  const [papelConvite, setPapelConvite] = useState('operador');
  const [novo, setNovo] = useState(NOVO);
  const [errosNovo, setErrosNovo] = useState({});
  const [msg, setMsg] = useState({ texto: '', erro: false });

  const aviso = (texto, erro = false) => setMsg({ texto, erro });

  const carregar = useCallback(async () => {
    try {
      setDados(await api('/equipe'));
    } catch (e) {
      aviso(e.message, true);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function gerarConvite() {
    aviso('');
    try {
      const r = await api('/equipe/convites', { metodo: 'POST', corpo: { papel: papelConvite } });
      setConvite({ codigo: r.codigo, link: `${window.location.origin}/cadastro?convite=${r.codigo}` });
      carregar();
    } catch (e) { aviso(e.message, true); }
  }

  async function revogar(c) {
    try {
      await api(`/equipe/convites/${c.id}`, { metodo: 'DELETE' });
      carregar();
    } catch (e) { aviso(e.message, true); }
  }

  async function criar(e) {
    e.preventDefault();
    aviso('');
    setErrosNovo({});
    try {
      await api('/equipe/membros', { metodo: 'POST', corpo: novo });
      setNovo(NOVO);
      aviso('Usuário criado. Informe a senha provisória a ele.');
      carregar();
    } catch (err) {
      setErrosNovo(err.campos ?? {});
      aviso(err.message, true);
    }
  }

  async function mudarPapel(m, papel) {
    try {
      await api(`/equipe/membros/${m.id}`, { metodo: 'PATCH', corpo: { papel } });
      carregar();
    } catch (e) { aviso(e.message, true); carregar(); }
  }

  async function remover(m) {
    if (!window.confirm(`Remover ${m.nome} da organização? A pessoa perde o acesso na hora.`)) return;
    try {
      await api(`/equipe/membros/${m.id}`, { metodo: 'DELETE' });
      carregar();
    } catch (e) { aviso(e.message, true); }
  }

  const campo = (k, ph, tipo = 'text') => (
    <input type={tipo} placeholder={ph} aria-label={ph} value={novo[k]} required
           aria-invalid={!!errosNovo[k]} title={errosNovo[k]} style={errosNovo[k] ? { borderColor: 'var(--erro)' } : undefined}
           autoComplete={k === 'senha' ? 'new-password' : 'off'}
           onChange={(e) => setNovo((n) => ({ ...n, [k]: e.target.value }))} />
  );

  return (
    <>
      <h1>Equipe</h1>
      <p className="app-sub">Quem tem acesso a <b>{usuario.organizacao?.nome}</b>. <b>Dono</b> gerencia máquinas, regras e equipe; <b>operador</b> consulta e liga/desliga a máquina.</p>

      <div className="pilha">
        <section className="painel">
          <h2>Pessoas</h2>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Nome</th><th>Usuário</th><th>E-mail</th><th>Papel</th><th /></tr></thead>
              <tbody>
                {dados.membros.map((m) => {
                  const eu = m.id === usuario.id;
                  return (
                    <tr key={m.id}>
                      <td>{m.nome}{eu && ' (você)'}</td>
                      <td>{m.usuario}</td>
                      <td>{m.email}</td>
                      <td>
                        <select value={m.papel} onChange={(e) => mudarPapel(m, e.target.value)} aria-label={`Papel de ${m.nome}`}
                                style={{ height: 36, borderRadius: 999, background: 'var(--campo)', color: 'var(--texto)', border: '1px solid var(--borda)', padding: '0 12px' }}>
                          <option value="operador">operador</option>
                          <option value="dono">dono</option>
                        </select>
                      </td>
                      <td><button className="btn btn-perigo btn-sm" disabled={eu} onClick={() => remover(m)}>Remover</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="painel">
          <h2>Convidar por código</h2>
          <p className="app-sub" style={{ marginBottom: 0 }}>A pessoa se cadastra com o código e já entra na sua empresa. Vale por 7 dias e só pode ser usado uma vez.</p>
          <div className="form-inline">
            <select value={papelConvite} onChange={(e) => setPapelConvite(e.target.value)} aria-label="Papel do convidado">
              <option value="operador">Entrar como operador</option>
              <option value="dono">Entrar como dono</option>
            </select>
            <button className="btn btn-solido btn-sm" onClick={gerarConvite}>Gerar convite</button>
          </div>

          {convite && (
            <div className="token-box" role="status">
              <strong>Copie agora: o código não será mostrado de novo.</strong>
              <pre>{convite.codigo}{'\n'}{convite.link}</pre>
              <button className="btn btn-contorno btn-sm" onClick={() => navigator.clipboard?.writeText(convite.link)}>Copiar link</button>
            </div>
          )}

          {dados.convites.length > 0 && (
            <>
              <h2 style={{ marginTop: 22 }}>Convites pendentes</h2>
              <ul className="resumo-dias">
                {dados.convites.map((c) => (
                  <li key={c.id}>
                    <span>{c.papel}</span>
                    <small>expira em {fmtData(c.expiraEm)}</small>
                    <button className="btn btn-perigo btn-sm" onClick={() => revogar(c)}>Revogar</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="painel">
          <h2>Criar usuário direto</h2>
          <p className="app-sub" style={{ marginBottom: 0 }}>Para quem não vai se cadastrar sozinho. Você define uma senha provisória e a passa à pessoa.</p>
          <form className="form-inline" onSubmit={criar}>
            {campo('nome', 'Nome completo')}
            {campo('usuario', 'Usuário')}
            {campo('email', 'E-mail', 'email')}
            {campo('senha', 'Senha provisória (8+, letra e número)', 'password')}
            <select value={novo.papel} onChange={(e) => setNovo((n) => ({ ...n, papel: e.target.value }))} aria-label="Papel">
              <option value="operador">operador</option>
              <option value="dono">dono</option>
            </select>
            <button className="btn btn-solido btn-sm" type="submit">Criar usuário</button>
          </form>
        </section>
      </div>

      {msg.texto && <p className={`msg-app${msg.erro ? ' erro' : ''}`} role={msg.erro ? 'alert' : 'status'}>{msg.texto}</p>}
    </>
  );
}
