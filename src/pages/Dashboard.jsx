import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useEstoqueRealtime } from '../hooks/useEstoqueRealtime.js';

const fmt = (n) => n.toLocaleString('pt-BR');
const fmt1 = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const fmtDia = (d) => d.slice(8) + '/' + d.slice(5, 7);
const fmtHora = (iso) => new Date(iso).toLocaleTimeString('pt-BR');
const tipo = (i) => `${i.bitola} × ${i.comprimentoMm} mm`;

export default function Dashboard() {
  const { estoque, estatisticas: est, dispositivo, telemetria, ultimas, conectado, erro } = useEstoqueRealtime();
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [, tick] = useState(0);

  // atualiza o "há X s" da balança
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function comando(corpo, ok) {
    setAviso('');
    setEnviando(true);
    try {
      await api('/dispositivo/comando', { metodo: 'POST', corpo: { deviceId: dispositivo?.deviceId, ...corpo } });
      setAviso(ok);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setEnviando(false);
    }
  }

  if (erro) return <p className="erro" role="alert">{erro}</p>;
  if (!estoque) return <p className="vazio">Carregando estoque...</p>;

  const maxBitola = Math.max(estoque.limiteBaixo * 4, ...Object.values(estoque.totaisPorBitola), 1);
  const bitolas = Object.keys(estoque.totaisPorBitola);
  const comprimentos = [...new Set(estoque.itens.map((i) => i.comprimentoMm))];
  const qtd = (c, b) => estoque.itens.find((i) => i.comprimentoMm === c && i.bitola === b)?.quantidade ?? 0;

  const segundos = telemetria ? Math.round((Date.now() - telemetria.recebidoEm) / 1000) : null;
  const aoVivo = telemetria && segundos <= 5;
  const maxDia = Math.max(...(est?.ultimos7Dias.map((d) => d.total) ?? [1]), 1);

  return (
    <>
      <h1>Estoque em tempo real</h1>
      <p className="app-sub">Contagem de peças válidas por bitola e comprimento, já descontados os pedidos.</p>

      <div className="status-linha">
        <span className={`pilula${conectado ? ' on' : ''}`}><i />{conectado ? 'Tempo real ativo' : 'Sem tempo real'}</span>
        <span className={`pilula${dispositivo?.online ? ' on' : ''}`}>
          <i />{dispositivo?.nome ?? 'Dispositivo'}: {dispositivo?.online ? 'online' : 'offline'}
        </span>
        <span className={`pilula${dispositivo?.ligado ? ' on' : ''}`}><i />Separador {dispositivo?.ligado ? 'ligado' : 'desligado'}</span>
        <div className="acoes-topo">
          <Link to="/app/pedidos" className="btn btn-solido btn-sm">Pedido de parafusos</Link>
          <button className="btn btn-contorno btn-sm" disabled={enviando || !dispositivo}
                  onClick={() => comando({ tara: true }, 'Tara enviada: a balança será zerada.')}>Zerar balança</button>
          <button className={`btn btn-sm ${dispositivo?.ligado ? 'btn-perigo' : 'btn-contorno'}`} disabled={enviando || !dispositivo}
                  onClick={() => comando({ ligado: !dispositivo?.ligado }, 'Comando enviado. Aguardando confirmação do dispositivo...')}>
            {dispositivo?.ligado ? 'Desligar separador' : 'Ligar separador'}
          </button>
        </div>
      </div>

      {!dispositivo && (
        <div className="alerta-baixo" role="status">
          <strong>Nenhuma máquina vinculada.</strong> Adicione uma em <Link to="/app/configuracoes">Configurações → Máquinas</Link> para começar a contar.
        </div>
      )}
      {aviso && <p className="app-sub" role="status">{aviso}</p>}

      {estoque.estoqueBaixo && (
        <div className="alerta-baixo" role="alert">
          <strong>Estoque baixo:</strong> {estoque.bitolasBaixas.join(', ')} abaixo de {fmt(estoque.limiteBaixo)} peças.
        </div>
      )}

      <div className="stats">
        <div className={`stat destaque${estoque.menorEstoque && estoque.menorEstoque.quantidade < estoque.limiteBaixo ? ' baixo' : ''}`}>
          <span className="stat-rotulo">Parafuso com menos estoque</span>
          {estoque.menorEstoque ? (
            <>
              <b className="stat-valor">{tipo(estoque.menorEstoque)}</b>
              <span className="stat-detalhe">{fmt(estoque.menorEstoque.quantidade)} peças restantes</span>
              {estoque.menores.length > 1 && (
                <span className="stat-detalhe">Depois: {estoque.menores.slice(1).map((m) => `${tipo(m)} (${fmt(m.quantidade)})`).join(' · ')}</span>
              )}
            </>
          ) : (
            <span className="stat-detalhe">Aparece quando a primeira peça for contada.</span>
          )}
        </div>
        <div className="stat">
          <span className="stat-rotulo">Contadas hoje</span>
          <b className="stat-valor">{fmt(est?.hoje ?? 0)}</b>
          <span className="stat-detalhe">peças válidas</span>
        </div>
        <div className="stat">
          <span className="stat-rotulo">Média por dia</span>
          <b className="stat-valor">{fmt1(est?.mediaPorDia ?? 0)}</b>
          <span className="stat-detalhe">em {est?.diasAtivos ?? 0} dia(s) com contagem</span>
        </div>
        <div className="stat">
          <span className="stat-rotulo">Média dos últimos 7 dias</span>
          <b className="stat-valor">{fmt1(est?.mediaUltimos7Dias ?? 0)}</b>
          <span className="stat-detalhe">dias parados contam como 0</span>
        </div>
        <div className="stat">
          <span className="stat-rotulo">Peças rejeitadas</span>
          <b className="stat-valor">{fmt1(est?.taxaRejeicao ?? 0)}%</b>
          <span className="stat-detalhe">{fmt(est?.pecasRejeitadas ?? 0)} fora da faixa de peso</span>
        </div>
        <div className="stat">
          <span className="stat-rotulo">Retirado em pedidos</span>
          <b className="stat-valor">{fmt(est?.totalRetirado ?? 0)}</b>
          <span className="stat-detalhe">{est?.pedidosAbertos ?? 0} pedido(s) aberto(s)</span>
        </div>
      </div>

      <div className="grade-dash">
        <section className="painel balanca">
          <h2>Balança agora</h2>
          {aoVivo ? (
            <>
              <b className="balanca-valor">{telemetria.peso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g</b>
              <span className={`pilula${telemetria.estavel ? ' on' : ''}`}><i />{telemetria.estavel ? 'leitura estável' : 'medindo...'}</span>
              <span className="stat-detalhe">atualizado há {segundos}s{telemetria.rssi != null && ` · Wi-Fi ${telemetria.rssi} dBm`}</span>
            </>
          ) : (
            <p className="vazio" style={{ padding: 8 }}>Sem leitura ao vivo. Ligue a máquina para ver o peso da célula de carga aqui.</p>
          )}
        </section>

        <section className="painel">
          <h2>Total por bitola</h2>
          <ul className="totais">
            {bitolas.map((b) => (
              <li key={b} className={estoque.bitolasBaixas.includes(b) ? 'baixo' : ''}>
                <span className="nome">{b}</span>
                <div className="barra"><i style={{ width: `${Math.min(100, (estoque.totaisPorBitola[b] / maxBitola) * 100)}%` }} /></div>
                <b className="qtd">{fmt(estoque.totaisPorBitola[b])}</b>
              </li>
            ))}
          </ul>
          <div className="total-geral"><span>Peças em estoque</span><b>{fmt(estoque.total)}</b></div>
        </section>

        <section className="painel">
          <h2>Comprimento × bitola</h2>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Comprimento</th>{bitolas.map((b) => <th key={b}>{b}</th>)}</tr></thead>
              <tbody>
                {comprimentos.map((c) => (
                  <tr key={c}><td>{c} mm</td>{bitolas.map((b) => <td key={b}>{fmt(qtd(c, b))}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="painel">
          <h2>Últimos 7 dias</h2>
          <div className="grafico" role="img" aria-label="Peças contadas por dia nos últimos 7 dias">
            {(est?.ultimos7Dias ?? []).map((d) => (
              <div className="grafico-col" key={d.dia}>
                <span className="grafico-num">{d.total}</span>
                <div className="grafico-barra" style={{ height: `${Math.max(3, (d.total / maxDia) * 100)}%` }} />
                <span className="grafico-dia">{fmtDia(d.dia)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="painel largo">
          <h2>Últimas peças</h2>
          {ultimas.length === 0 ? (
            <p className="vazio">Nenhuma peça ainda.</p>
          ) : (
            <ul className="feed">
              {ultimas.map((u) => (
                <li key={u.id} className={u.valido ? '' : 'invalida'}>
                  <span>{fmtHora(u.ocorridoEm)}</span>
                  <b>{u.valido ? `${u.bitola} × ${u.comprimentoMm} mm` : `Rejeitada (${u.comprimentoMm} mm)`}</b>
                  <small>{u.peso.toFixed(2)} g</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
