import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Configuracoes() {
  const { usuario } = useAuth();
  const dono = usuario.papel === 'dono';

  const [maquinas, setMaquinas] = useState([]);
  const [config, setConfig] = useState(null);
  const [nome, setNome] = useState('');
  const [limite, setLimite] = useState('');
  const [segredo, setSegredo] = useState(null); // { deviceId, token } (aparece uma vez)
  const [msg, setMsg] = useState({ texto: '', erro: false });

  const aviso = (texto, erro = false) => setMsg({ texto, erro });

  const carregar = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([api('/dispositivo'), api('/config')]);
      setMaquinas(d.dispositivos);
      setConfig(c);
      setLimite(String(c.limiteBaixo));
    } catch (e) {
      aviso(e.message, true);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar(e) {
    e.preventDefault();
    aviso('');
    try {
      const r = await api('/dispositivo', { metodo: 'POST', corpo: { nome } });
      setSegredo({ deviceId: r.dispositivo.deviceId, token: r.token });
      setNome('');
      carregar();
    } catch (err) {
      aviso(err.campos?.nome ?? err.message, true);
    }
  }

  async function novoToken(m) {
    if (!window.confirm(`Gerar um novo token para "${m.nome}"? O antigo para de funcionar e a máquina precisa ser atualizada.`)) return;
    try {
      const r = await api(`/dispositivo/${m.id}/token`, { metodo: 'POST' });
      setSegredo({ deviceId: r.dispositivo.deviceId, token: r.token });
      carregar();
    } catch (err) { aviso(err.message, true); }
  }

  async function remover(m) {
    if (!window.confirm(`Remover "${m.nome}"? O histórico de peças já contadas continua guardado.`)) return;
    try {
      await api(`/dispositivo/${m.id}`, { metodo: 'DELETE' });
      if (segredo?.deviceId === m.deviceId) setSegredo(null);
      carregar();
    } catch (err) { aviso(err.message, true); }
  }

  async function salvarLimite(e) {
    e.preventDefault();
    try {
      await api('/config', { metodo: 'PUT', corpo: { limiteBaixo: Number(limite) } });
      aviso('Regras salvas.');
      carregar();
    } catch (err) { aviso(err.campos?.limiteBaixo ?? err.message, true); }
  }

  const trechoSecrets = segredo && `#define DEVICE_ID    "${segredo.deviceId}"\n#define DEVICE_TOKEN "${segredo.token}"`;

  return (
    <>
      <h1>Configurações</h1>
      <p className="app-sub">Organização: <b>{usuario.organizacao?.nome}</b>{!dono && ' · somente o dono pode alterar'}</p>

      <div className="pilha">
        <section className="painel">
          <h2>Máquinas</h2>
          {maquinas.length === 0 ? (
            <p className="vazio">Nenhuma máquina vinculada ainda.</p>
          ) : (
            <ul className="maquinas">
              {maquinas.map((m) => (
                <li className="maquina" key={m.id}>
                  <div className="maquina-info"><b>{m.nome}</b><code>{m.deviceId}</code></div>
                  <span className={`pilula${m.online ? ' on' : ''}`}><i />{m.online ? 'online' : 'offline'}</span>
                  {dono && (
                    <div className="acoes">
                      <button className="btn btn-contorno btn-sm" onClick={() => novoToken(m)}>Novo token</button>
                      <button className="btn btn-perigo btn-sm" onClick={() => remover(m)}>Remover</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {dono && (
            <form className="form-inline" onSubmit={adicionar}>
              <input type="text" placeholder="Nome da nova máquina (ex.: Bancada 1)" value={nome}
                     onChange={(e) => setNome(e.target.value)} maxLength={40} aria-label="Nome da máquina" required />
              <button className="btn btn-solido btn-sm" type="submit">Adicionar máquina</button>
            </form>
          )}

          {segredo && (
            <div className="token-box" role="status">
              <strong>Copie agora: o token não será mostrado de novo.</strong>
              <pre>{trechoSecrets}</pre>
              <p>Cole essas duas linhas no <code>iot/secrets.h</code> do ESP32 e grave o firmware. Para testar sem hardware:
                {' '}<code>npm run simular -- {segredo.deviceId} {segredo.token}</code></p>
              <button className="btn btn-contorno btn-sm" style={{ marginTop: 12 }}
                      onClick={() => navigator.clipboard?.writeText(trechoSecrets)}>Copiar</button>
            </div>
          )}
        </section>

        <section className="painel">
          <h2>Regras do estoque</h2>
          <p className="app-sub" style={{ marginBottom: 0 }}>Avisar “estoque baixo” quando uma bitola tiver menos peças que este limite.</p>
          <form className="form-inline" onSubmit={salvarLimite}>
            <input type="number" min="0" value={limite} onChange={(e) => setLimite(e.target.value)}
                   aria-label="Limite de estoque baixo" disabled={!dono || !config} />
            {dono && <button className="btn btn-solido btn-sm" type="submit">Salvar</button>}
          </form>
        </section>
      </div>

      {msg.texto && <p className={`msg-app${msg.erro ? ' erro' : ''}`} role={msg.erro ? 'alert' : 'status'}>{msg.texto}</p>}
    </>
  );
}
