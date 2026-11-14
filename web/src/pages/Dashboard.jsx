import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useEstoqueRealtime } from '../hooks/useEstoqueRealtime.js';
import { Colunas, Linha, Rosca } from '../components/Graficos.jsx';

const fmt = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const fmtHora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dm = (d) => `${d.slice(8)}/${d.slice(5, 7)}`;
const tipo = (i) => `${i.bitola} × ${i.comprimentoMm} mm`;
const ROTULO_STATUS = {
  ok: 'Ok',
  atencao: 'Atenção',
  critico: 'Crítico',
  esgotado: 'Esgotado',
  'sem-consumo': 'Sem consumo',
};

function Indicador({ rotulo, valor, detalhe, destaque = false }) {
  return (
    <div className={`stat${destaque ? ' principal' : ''}`}>
      <span className="stat-rotulo">{rotulo}</span>
      <b className="stat-valor">{valor}</b>
      <span className="stat-detalhe">{detalhe}</span>
    </div>
  );
}

export default function Dashboard() {
  const {
    estoque,
    estatisticas: est,
    previsao: prev,
    maquinas,
    dispositivo,
    selecionarMaquina,
    telemetria,
    ultimas,
    conectado,
    carregando,
    avisos,
    atualizar,
  } = useEstoqueRealtime();
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function comando(corpo) {
    setAviso(null);
    setEnviando(true);
    try {
      await api('/dispositivo/comando', {
        metodo: 'POST',
        timeoutMs: 15000,
        corpo: { deviceId: dispositivo.deviceId, ...corpo },
      });
      setAviso({ texto: 'Comando enviado. Aguarde a atualização da máquina.', erro: false });
    } catch (e) {
      setAviso({ texto: e.message, erro: true });
    } finally {
      setEnviando(false);
    }
  }

  if (!estoque)
    return (
      <section className="painel estado-dashboard" aria-busy={carregando}>
        <span className="sobretitulo">Visão geral</span>
        <h1>{carregando ? 'Preparando seu estoque…' : 'Não foi possível carregar o estoque'}</h1>
        <p className="app-sub">
          {carregando
            ? 'Buscando contagens, máquinas e pedidos da sua empresa.'
            : (avisos[0] ?? 'Verifique a conexão e tente novamente.')}
        </p>
        {!carregando && (
          <button className="btn btn-solido" onClick={atualizar}>
            Tentar novamente
          </button>
        )}
      </section>
    );

  const dias14 = est?.ultimos14Dias ?? [];
  const segundos = telemetria ? Math.max(0, Math.round((Date.now() - telemetria.recebidoEm) / 1000)) : null;
  const aoVivo = conectado && dispositivo?.online && telemetria && segundos <= 5;
  const bitolas = Object.keys(estoque.totaisPorBitola);
  const comprimentos = [...new Set(estoque.itens.map((i) => i.comprimentoMm))];
  const barrasPrevisao =
    prev && !prev.semDados
      ? [
          ...prev.historico.map((h) => ({ dia: h.dia, valores: [h.total] })),
          ...prev.previsao.map((p) => ({ dia: p.dia, valores: [p.previsto], previsto: true })),
        ]
      : [];

  return (
    <div className="dashboard">
      <header className="dash-cabecalho">
        <div>
          <span className="sobretitulo">Visão geral da operação</span>
          <h1>Seu estoque, em movimento.</h1>
          <p className="app-sub">Acompanhe a contagem e encontre o próximo passo da sua operação.</p>
        </div>
        <div className="dash-acoes">
          <button className="btn btn-contorno btn-sm" onClick={atualizar} disabled={carregando}>
            {carregando ? 'Atualizando…' : 'Atualizar dados'}
          </button>
          <Link to="/app/pedidos" className="btn btn-solido btn-sm">
            Reservar parafusos <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      <div className="dash-conexao" role="status">
        <span className={`pilula${conectado ? ' on' : ''}`}>
          <i />
          {conectado ? 'Atualização em tempo real' : 'Tempo real desconectado'}
        </span>
        <span className="stat-detalhe">
          {conectado
            ? 'As novas contagens aparecem automaticamente.'
            : 'Os dados podem estar desatualizados. Tentando reconectar…'}
        </span>
        <span className="dash-hora">Último saldo às {fmtHora(estoque.atualizadoEm)}</span>
      </div>
      {avisos.length > 0 && (
        <div className="aviso-dashboard" role="alert">
          <strong>Alguns dados não puderam ser atualizados.</strong>
          <ul>
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <button className="btn btn-contorno btn-sm" onClick={atualizar} disabled={carregando}>
            Tentar novamente
          </button>
        </div>
      )}
      {!dispositivo && (
        <section className="primeiros-passos">
          <div>
            <span className="sobretitulo">Vamos começar</span>
            <h2>Conecte sua primeira máquina</h2>
            <p>
              Adicione uma máquina, aguarde a conexão e faça a primeira contagem. Seu estoque será atualizado
              aqui.
            </p>
          </div>
          <Link to="/app/configuracoes" className="btn btn-solido btn-sm">
            Configurar máquina
          </Link>
        </section>
      )}
      {estoque.estoqueBaixo && (
        <div className="alerta-baixo" role="status">
          <strong>Atenção ao estoque:</strong> {(estoque.tiposBaixos ?? []).map((i) => `${i.bitola} ${i.comprimentoMm} mm (${fmt(i.quantidade)})`).join(', ')} com menos de{' '}
          {fmt(estoque.limiteBaixo)} peças. Consulte as combinações abaixo antes de reservar.
        </div>
      )}

      <div className="stats stats-principais">
        <Indicador
          rotulo="Disponíveis agora"
          valor={fmt(estoque.total)}
          detalhe="peças livres, descontadas as reservas"
          destaque
        />
        <Indicador
          rotulo="Contadas hoje"
          valor={est ? fmt(est.hoje) : '—'}
          detalhe="peças válidas · horário de São Paulo"
        />
        <Indicador
          rotulo="Média diária · 14 dias"
          valor={est ? fmt(est.mediaUltimos14Dias) : '—'}
          detalhe="peças/dia · inclui dias sem contagem"
        />
        <Indicador
          rotulo="Desvio padrão · 14 dias"
          valor={est ? fmt(est.desvioPadraoUltimos14Dias) : '—'}
          detalhe="peças/dia · variação em torno da média"
        />
      </div>
      <details className="explicacao-metrica">
        <summary>Como interpretar a média e o desvio padrão?</summary>
        <p>
          A média divide as peças válidas dos últimos 14 dias por 14. O desvio padrão populacional mostra
          quanto a contagem diária varia em torno dessa média: quanto menor, mais regular é a produção.
        </p>
        <p>
          Os dois indicadores usam os mesmos 14 dias corridos, incluindo dias zerados e o dia de hoje, ainda
          em andamento, no fuso de São Paulo. O desvio usa divisor 14 e não é o erro padrão da média.
        </p>
      </details>

      <div className="grade-dash">
        <section className="painel painel-contagem">
          <div className="painel-titulo">
            <div>
              <span className="sobretitulo">Ritmo da operação</span>
              <h2>Contagem diária</h2>
            </div>
            <span className="etiqueta">Últimos 14 dias</span>
          </div>
          {est ? (
            <>
              <Linha
                pontos={dias14.map((d) => ({ dia: d.dia, valor: d.total }))}
                media={est.mediaUltimos14Dias}
                rotulo="Contagem diária e média dos últimos 14 dias"
              />
              <div className="resumo-metrica">
                <span>
                  Média <b>{fmt(est.mediaUltimos14Dias)}</b> peças/dia
                </span>
                <span>
                  Desvio padrão <b>{fmt(est.desvioPadraoUltimos14Dias)}</b> peças/dia
                </span>
              </div>
              <details className="dados-grafico">
                <summary>Ver valores por dia</summary>
                <div className="tabela-wrap">
                  <table className="tabela">
                    <caption>Contagem de peças válidas por dia</caption>
                    <thead>
                      <tr>
                        <th scope="col">Dia</th>
                        <th scope="col">Peças contadas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dias14.map((d) => (
                        <tr key={d.dia}>
                          <th scope="row">{dm(d.dia)}</th>
                          <td>{fmt(d.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <p className="vazio">
              Contagem diária indisponível. Use “Atualizar dados” para tentar novamente.
            </p>
          )}
        </section>

        <section className="painel balanca">
          <div className="painel-titulo">
            <div>
              <span className="sobretitulo">Máquina selecionada</span>
              <h2>Balança ao vivo</h2>
            </div>
            <span className={`pilula${dispositivo?.online ? ' on' : ''}`}>
              <i />
              {dispositivo?.online ? 'Online' : 'Offline'}
            </span>
          </div>
          {maquinas.length > 0 && (
            <label className="seletor-maquina">
              Máquina
              <select
                value={dispositivo?.deviceId ?? ''}
                onChange={(e) => {
                  selecionarMaquina(e.target.value);
                  setAviso(null);
                }}
              >
                {maquinas.map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="peso-painel">
            <b className="balanca-valor">
              {aoVivo
                ? telemetria.peso.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : '—'}{' '}
              <small>g</small>
            </b>
            <span className="stat-detalhe">
              {aoVivo
                ? `${telemetria.estavel ? 'Leitura estável' : 'Peso em estabilização'} · há ${segundos}s`
                : dispositivo
                  ? 'Aguardando uma leitura recente desta máquina.'
                  : 'Conecte uma máquina para acompanhar o peso.'}
            </span>
          </div>
          <div className="maquina-operacao">
            <span>Separador</span>
            <b>{!dispositivo ? 'Não configurado' : dispositivo.ligado ? 'Ligado' : 'Desligado'}</b>
          </div>
          <div className="maquina-botoes">
            <button
              className="btn btn-contorno btn-sm"
              disabled={enviando || !dispositivo?.online}
              onClick={() => comando({ tara: true })}
            >
              Zerar balança
            </button>
            <button
              className={`btn btn-sm ${dispositivo?.ligado ? 'btn-perigo' : 'btn-solido'}`}
              disabled={enviando || !dispositivo?.online}
              onClick={() => comando({ ligado: !dispositivo.ligado })}
            >
              {enviando ? 'Enviando…' : dispositivo?.ligado ? 'Desligar' : 'Ligar'}
            </button>
          </div>
          <p className="nota">
            {dispositivo && !dispositivo.online
              ? 'Máquina offline. Inicie o Wokwi e aguarde a conexão MQTT para liberar os comandos.'
              : 'Os comandos são enviados à máquina. O estado muda quando ela confirma a atualização.'}
          </p>
          {aviso && (
            <p className={`msg-app${aviso.erro ? ' erro' : ''}`} role={aviso.erro ? 'alert' : 'status'}>
              {aviso.texto}
            </p>
          )}
        </section>

        <section className="painel">
          <div className="painel-titulo">
            <div>
              <span className="sobretitulo">Disponibilidade</span>
              <h2>Estoque por bitola</h2>
            </div>
          </div>
          <Rosca
            rotulo="Distribuição do estoque disponível por bitola"
            centro="disponíveis"
            fatias={bitolas.map((b) => ({ nome: b, valor: estoque.totaisPorBitola[b] }))}
          />
          {estoque.menorEstoque && (
            <div className="estoque-prioridade">
              <span className="stat-detalhe">Menor estoque entre os tipos já contados</span>
              <b>{tipo(estoque.menorEstoque)}</b>
              <span>{fmt(estoque.menorEstoque.quantidade)} peças disponíveis</span>
            </div>
          )}
        </section>
        <section className="painel">
          <div className="painel-titulo">
            <div>
              <span className="sobretitulo">Encontre suas peças</span>
              <h2>Comprimento × bitola</h2>
            </div>
            <Link to="/app/pedidos">Reservar peças →</Link>
          </div>
          <div className="tabela-wrap">
            <table className="tabela">
              <caption>Peças disponíveis por comprimento e bitola</caption>
              <thead>
                <tr>
                  <th scope="col">Comprimento</th>
                  {bitolas.map((b) => (
                    <th scope="col" key={b}>
                      {b}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comprimentos.map((c) => (
                  <tr key={c}>
                    <th scope="row">{c} mm</th>
                    {bitolas.map((b) => (
                      <td key={b}>
                        {fmt(
                          estoque.itens.find((i) => i.comprimentoMm === c && i.bitola === b)?.quantidade ?? 0
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <div className="stats stats-secundarias">
        <Indicador
          rotulo="Peças reservadas"
          valor={est ? fmt(est.totalReservado) : '—'}
          detalhe={`${est?.pedidosAbertos ?? 0} pedido(s) aguardando retirada`}
        />
        <Indicador
          rotulo="Retiradas confirmadas"
          valor={est ? fmt(est.totalRetiradoConfirmado) : '—'}
          detalhe="peças recolhidas nos pedidos"
        />
        <Indicador
          rotulo="Taxa de rejeição"
          valor={est ? `${fmt(est.taxaRejeicao)}%` : '—'}
          detalhe={`${fmt(est?.pecasRejeitadas ?? 0)} peças rejeitadas no histórico`}
        />
        <Indicador
          rotulo="Média em dias ativos"
          valor={est ? fmt(est.mediaPorDia) : '—'}
          detalhe={`${est?.diasAtivos ?? 0} dia(s) com contagem no histórico`}
        />
      </div>
      <div className="grade-dash">
        <section className="painel">
          <div className="painel-titulo">
            <div>
              <span className="sobretitulo">Movimentações</span>
              <h2>Entradas e peças comprometidas</h2>
            </div>
          </div>
          <p className="nota nota-topo">
            Pedidos abertos e retirados, agrupados pela data do pedido. Cancelados não entram.
          </p>
          {est ? (
            <>
              <div className="legenda">
                <span>
                  <i style={{ background: 'var(--verde)' }} />
                  Contadas
                </span>
                <span>
                  <i style={{ background: 'var(--alerta)' }} />
                  Comprometidas em pedidos
                </span>
              </div>
              <Colunas
                itens={dias14.map((d) => ({ dia: d.dia, valores: [d.total, d.retirados] }))}
                series={[
                  { nome: 'Contadas', cor: 'var(--verde)' },
                  { nome: 'Comprometidas', cor: 'var(--alerta)' },
                ]}
                rotulo="Entradas e peças comprometidas em pedidos nos últimos 14 dias"
              />
            </>
          ) : (
            <p className="vazio">Movimentações indisponíveis.</p>
          )}
        </section>
        <section className="painel">
          <div className="painel-titulo">
            <div>
              <span className="sobretitulo">Atividade recente</span>
              <h2>Últimas peças</h2>
            </div>
            <Link to="/app/historico">Ver histórico →</Link>
          </div>
          {ultimas.length === 0 ? (
            <p className="vazio">As primeiras peças aparecerão aqui assim que forem contadas.</p>
          ) : (
            <ul className="feed">
              {ultimas.map((u) => (
                <li key={u.id} className={u.valido ? '' : 'invalida'}>
                  <span>{fmtHora(u.ocorridoEm)}</span>
                  <b>{u.valido ? tipo(u) : `Rejeitada · ${u.comprimentoMm} mm`}</b>
                  <small>
                    {u.peso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="painel largo">
          <div className="painel-titulo">
            <div>
              <span className="sobretitulo">Planeje a reposição</span>
              <h2>Previsão de consumo</h2>
            </div>
            {prev && !prev.semDados && (
              <span className={`selo-conf ${prev.confianca}`}>Confiança {prev.confianca}</span>
            )}
          </div>
          {!prev ? (
            <p className="vazio">Previsão indisponível no momento. O estoque continua disponível acima.</p>
          ) : prev.semDados ? (
            <div className="vazio">
              <p>Ainda não há pedidos suficientes para uma previsão.</p>
              <Link to="/app/pedidos">Faça a primeira reserva para começar →</Link>
            </div>
          ) : (
            <>
              <p className="app-sub">
                Estimativa de <b>{fmt(prev.consumoDiario)} peças por dia</b> e{' '}
                <b>{fmt(prev.previstoProximos7Dias)} peças nos próximos 7 dias</b>, com base nos pedidos não
                cancelados.
              </p>
              <div className="legenda">
                <span>
                  <i style={{ background: 'var(--alerta)' }} />
                  Pedidos feitos
                </span>
                <span>
                  <i className="tracejado" />
                  Estimativa
                </span>
              </div>
              <Colunas
                itens={barrasPrevisao}
                series={[{ nome: 'Pedidos', cor: 'var(--alerta)' }]}
                rotulo="Histórico de pedidos e estimativa dos próximos 7 dias"
              />
              <details className="dados-grafico">
                <summary>Ver previsão de reposição por tipo</summary>
                <div className="tabela-wrap">
                  <table className="tabela">
                    <caption>Estimativa de consumo e reposição por tipo</caption>
                    <thead>
                      <tr>
                        <th scope="col">Tipo</th>
                        <th scope="col">Disponível</th>
                        <th scope="col">Consumo/dia</th>
                        <th scope="col">Duração</th>
                        <th scope="col">Repor para 14 dias</th>
                        <th scope="col">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prev.porTipo.map((t) => (
                        <tr key={`${t.bitola}-${t.comprimentoMm}`}>
                          <th scope="row">{tipo(t)}</th>
                          <td>{fmt(t.estoque)}</td>
                          <td>{fmt(t.consumoDiario)}</td>
                          <td>{t.diasRestantes == null ? 'Sem consumo' : `${fmt(t.diasRestantes)} dias`}</td>
                          <td>{fmt(t.reposicaoSugerida14Dias)}</td>
                          <td>
                            <span className={`etiqueta ${t.status}`}>{ROTULO_STATUS[t.status]}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <p className="nota">
                Método: {prev.metodo}.{' '}
                {prev.confianca === 'baixa' && 'Há poucos dados: use esta previsão apenas como referência. '}A
                estimativa não inclui peças que ainda serão contadas.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
