import { useCallback, useEffect, useState } from 'react';
import { api, lerToken } from '../services/api.js';
import { conectarSocket } from '../services/socket.js';
import { useAuth } from '../hooks/useAuth.jsx';

const fmtData = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const ROTULO = { aberto: 'Aberto', retirado: 'Retirado', cancelado: 'Cancelado' };

export default function Pedidos() {
  const { usuario } = useAuth();
  const [config, setConfig] = useState(null);
  const [estoque, setEstoque] = useState(null);
  const [lista, setLista] = useState(null);
  const [form, setForm] = useState({ bitola: '', comprimentoMm: '', quantidade: 1 });
  const [erros, setErros] = useState({});
  const [msg, setMsg] = useState({ texto: '', erro: false });
  const [enviando, setEnviando] = useState(false);

  const aviso = (texto, erro = false) => setMsg({ texto, erro });

  const carregar = useCallback(async () => {
    try {
      const [c, e, p] = await Promise.all([api('/config'), api('/estoque'), api('/pedidos', { query: { limite: 30 } })]);
      setConfig(c);
      setEstoque(e);
      setLista(p);
      setForm((f) => ({
        ...f,
        bitola: f.bitola || c.bitolas[0],
        comprimentoMm: f.comprimentoMm || c.comprimentosMm[0],
      }));
    } catch (err) {
      aviso(err.message, true);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // outros operadores pedindo/cancelando atualizam esta tela na hora
  useEffect(() => {
    const socket = conectarSocket(lerToken());
    socket.on('pedido:atualizado', carregar);
    socket.on('estoque:atualizado', setEstoque);
    return () => socket.disconnect();
  }, [carregar]);

  const disponivel = estoque?.itens.find(
    (i) => i.bitola === form.bitola && i.comprimentoMm === Number(form.comprimentoMm)
  )?.quantidade ?? 0;

  async function pedir(e) {
    e.preventDefault();
    aviso('');
    setErros({});
    setEnviando(true);
    try {
      await api('/pedidos', {
        metodo: 'POST',
        corpo: { bitola: form.bitola, comprimentoMm: Number(form.comprimentoMm), quantidade: Number(form.quantidade) },
      });
      aviso('Pedido feito! As peças já foram separadas do estoque.');
      setForm((f) => ({ ...f, quantidade: 1 }));
      carregar();
    } catch (err) {
      setErros(err.campos ?? {});
      aviso(err.message, true);
    } finally {
      setEnviando(false);
    }
  }

  async function acao(p, qual) {
    if (qual === 'cancelar' && !window.confirm(`Cancelar o pedido de ${p.quantidade} × ${p.bitola} ${p.comprimentoMm} mm? As peças voltam ao estoque.`)) return;
    try {
      await api(`/pedidos/${p.id}/${qual}`, { metodo: 'POST' });
      carregar();
    } catch (err) {
      aviso(err.message, true);
      carregar();
    }
  }

  return (
    <>
      <h1>Pedido de parafusos</h1>
      <p className="app-sub">Escolha o tipo, o comprimento e a quantidade. As peças saem do estoque na hora e a máquina posiciona a gaveta certa.</p>

      <div className="pilha">
        <section className="painel">
          <h2>Novo pedido</h2>
          {!config ? <p className="vazio">Carregando...</p> : (
            <form className="form-inline" onSubmit={pedir}>
              <label className="campo-rotulo">Tipo (bitola)
                <select value={form.bitola} onChange={(e) => setForm((f) => ({ ...f, bitola: e.target.value }))}>
                  {config.bitolas.map((b) => <option key={b}>{b}</option>)}
                </select>
              </label>
              <label className="campo-rotulo">Comprimento
                <select value={form.comprimentoMm} onChange={(e) => setForm((f) => ({ ...f, comprimentoMm: e.target.value }))}>
                  {config.comprimentosMm.map((c) => <option key={c} value={c}>{c} mm</option>)}
                </select>
              </label>
              <label className="campo-rotulo">Quantidade
                <input type="number" min="1" max={Math.max(1, disponivel)} value={form.quantidade}
                       aria-invalid={!!erros.quantidade} style={erros.quantidade ? { borderColor: 'var(--erro)' } : undefined}
                       onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))} required />
              </label>
              <button className="btn btn-solido btn-sm" type="submit" disabled={enviando || disponivel === 0}>
                {enviando ? 'Enviando...' : 'Fazer pedido'}
              </button>
            </form>
          )}
          <p className="msg-app" style={{ marginTop: 10 }}>
            Disponível: <b>{disponivel.toLocaleString('pt-BR')}</b> peça(s) de {form.bitola} × {form.comprimentoMm} mm
            {disponivel === 0 && ' — sem estoque deste tipo'}
          </p>
          {erros.quantidade && <p className="msg-app erro" role="alert">{erros.quantidade}</p>}
        </section>

        <section className="painel">
          <h2>Pedidos recentes</h2>
          {!lista ? <p className="vazio">Carregando...</p> : lista.itens.length === 0 ? (
            <p className="vazio">Nenhum pedido ainda.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead><tr><th>Quando</th><th>Quem</th><th>Parafuso</th><th>Qtd</th><th>Situação</th><th /></tr></thead>
                <tbody>
                  {lista.itens.map((p) => {
                    const pode = p.status === 'aberto' && (usuario.papel === 'dono' || p.solicitante.id === usuario.id);
                    return (
                      <tr key={p.id}>
                        <td>{fmtData(p.criadoEm)}</td>
                        <td>{p.solicitante.nome}</td>
                        <td>{p.bitola} × {p.comprimentoMm} mm</td>
                        <td>{p.quantidade.toLocaleString('pt-BR')}</td>
                        <td><span className={`etiqueta ${p.status}`}>{ROTULO[p.status]}</span></td>
                        <td>
                          {pode && (
                            <span className="acoes">
                              <button className="btn btn-solido btn-sm" onClick={() => acao(p, 'retirar')}>Retirei</button>
                              <button className="btn btn-perigo btn-sm" onClick={() => acao(p, 'cancelar')}>Cancelar</button>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {msg.texto && <p className={`msg-app${msg.erro ? ' erro' : ''}`} role={msg.erro ? 'alert' : 'status'}>{msg.texto}</p>}
    </>
  );
}
