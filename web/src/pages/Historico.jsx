import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

const fmtData = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
const fmtDia = (d) => d.split('-').reverse().join('/');

export default function Historico() {
  const [filtros, setFiltros] = useState({ bitola: '', valido: '', pagina: 1 });
  const [dados, setDados] = useState(null);
  const [dias, setDias] = useState([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api('/eventos/resumo').then((r) => setDias(r.dias.slice(0, 10))).catch(() => {});
  }, []);

  useEffect(() => {
    let ativo = true;
    api('/eventos', { query: { ...filtros, limite: 20 } })
      .then((r) => ativo && (setDados(r), setErro('')))
      .catch((e) => ativo && setErro(e.message));
    return () => { ativo = false; };
  }, [filtros]);

  const mudar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value, pagina: 1 }));

  return (
    <>
      <h1>Histórico</h1>
      <p className="app-sub">Cada peça processada pelo separador, com resumo por dia.</p>

      <div className="pilha">
        <section className="painel">
          <h2>Resumo por dia</h2>
          {dias.length === 0 ? (
            <p className="vazio">Ainda não há peças contadas.</p>
          ) : (
            <ul className="resumo-dias">
              {dias.map((d) => (
                <li key={d.dia}>
                  <span>{fmtDia(d.dia)}</span>
                  <small>{Object.entries(d.porBitola).map(([b, q]) => `${b}: ${q}`).join('  ·  ')}</small>
                  <b>{d.total} peças</b>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="painel">
          <h2>Peças processadas</h2>
          <div className="filtros">
            <select value={filtros.bitola} onChange={mudar('bitola')} aria-label="Filtrar por bitola">
              <option value="">Todas as bitolas</option>
              {['M2', 'M3', 'M4'].map((b) => <option key={b}>{b}</option>)}
            </select>
            <select value={filtros.valido} onChange={mudar('valido')} aria-label="Filtrar por situação">
              <option value="">Válidas e rejeitadas</option>
              <option value="true">Somente válidas</option>
              <option value="false">Somente rejeitadas</option>
            </select>
          </div>

          {erro && <p className="erro" role="alert">{erro}</p>}
          {!dados ? <p className="vazio">Carregando...</p> : dados.itens.length === 0 ? (
            <p className="vazio">Nenhuma peça encontrada com esses filtros.</p>
          ) : (
            <>
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead><tr><th>Quando</th><th>Comprimento</th><th>Bitola</th><th>Peso</th><th>Situação</th></tr></thead>
                  <tbody>
                    {dados.itens.map((e) => (
                      <tr key={e._id}>
                        <td>{fmtData(e.ocorridoEm)}</td>
                        <td>{e.comprimentoMm} mm</td>
                        <td>{e.bitola ?? '-'}</td>
                        <td>{e.peso.toFixed(2)}</td>
                        <td className={e.valido ? '' : 'invalida'}>{e.valido ? 'Válida' : 'Rejeitada'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="paginacao">
                <button className="btn btn-contorno btn-sm" disabled={dados.pagina <= 1}
                        onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina - 1 }))}>Anterior</button>
                <span>Página {dados.pagina} de {dados.paginas}</span>
                <button className="btn btn-contorno btn-sm" disabled={dados.pagina >= dados.paginas}
                        onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina + 1 }))}>Próxima</button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
