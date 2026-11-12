import mongoose from 'mongoose';
import { Pedido } from '../models/Pedido.js';
import { obterEstoque } from './estoque.service.js';

const TZ = 'America/Sao_Paulo';
const DIA_MS = 24 * 60 * 60 * 1000;
const JANELA = 28; // dias de histórico usados
const HORIZONTE = 7; // dias previstos
const ALFA = 0.3; // peso do dia mais recente na média móvel exponencial
const MIN_DIAS_SEMANA = 21; // com menos que isso não ajusta por dia da semana

const dia = (d) => d.toLocaleDateString('en-CA', { timeZone: TZ });
const diaDaSemana = (s) => new Date(`${s}T12:00:00Z`).getUTCDay();
const arred = (n) => Math.round(n * 10) / 10;
const soma = (v) => v.reduce((a, b) => a + b, 0);

// média móvel exponencial: dias recentes pesam mais que os antigos
export const mediaMovelExp = (serie) =>
  serie.reduce((nivel, x, i) => (i === 0 ? x : ALFA * x + (1 - ALFA) * nivel), 0);

// previsão do consumo dos próximos dias, com base nos pedidos já feitos.
// dias antes do primeiro pedido ficam de fora, senão puxariam a média para baixo
export async function preverPedidos(organizacaoId) {
  const org = new mongoose.Types.ObjectId(String(organizacaoId));
  const agora = Date.now();
  const datas = Array.from({ length: JANELA }, (_, i) => dia(new Date(agora - (JANELA - 1 - i) * DIA_MS)));
  const naoCancelado = { organizacaoId: org, status: { $ne: 'cancelado' } };

  const [linhas, primeiro, totalPedidos, estoque] = await Promise.all([
    Pedido.aggregate([
      { $match: { ...naoCancelado, createdAt: { $gte: new Date(agora - JANELA * DIA_MS) } } },
      {
        $group: {
          _id: {
            dia: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
            c: '$comprimentoMm',
            b: '$bitola',
          },
          total: { $sum: '$quantidade' },
        },
      },
    ]),
    Pedido.findOne(naoCancelado).sort({ createdAt: 1 }).select('createdAt').lean(),
    Pedido.countDocuments(naoCancelado),
    obterEstoque(organizacaoId),
  ]);

  const porDia = new Map();
  const porTipo = new Map();
  for (const l of linhas) {
    porDia.set(l._id.dia, (porDia.get(l._id.dia) ?? 0) + l.total);
    const k = `${l._id.c}|${l._id.b}`;
    if (!porTipo.has(k)) porTipo.set(k, new Map());
    porTipo.get(k).set(l._id.dia, l.total);
  }

  // só dias fechados entram na conta: hoje ainda está incompleto e puxaria a média para baixo
  const hoje = datas[datas.length - 1];
  const fechados = datas.slice(0, -1);
  let inicio = fechados.length;
  if (primeiro) {
    const i = fechados.indexOf(dia(primeiro.createdAt));
    inicio = i === -1 ? (dia(primeiro.createdAt) === hoje ? fechados.length : 0) : i;
  }
  const diasSerie = fechados.slice(inicio);
  const serie = diasSerie.map((d) => porDia.get(d) ?? 0);
  // se o primeiro pedido foi hoje, usa o que já houve hoje como melhor palpite
  const nivel = serie.length ? mediaMovelExp(serie) : porDia.get(hoje) ?? 0;

  // fator por dia da semana (só com 3 semanas ou mais de dados)
  const fator = Array(7).fill(1);
  const mediaSerie = serie.length ? soma(serie) / serie.length : 0;
  if (serie.length >= MIN_DIAS_SEMANA && mediaSerie > 0) {
    const s = Array(7).fill(0);
    const n = Array(7).fill(0);
    diasSerie.forEach((d, i) => { s[diaDaSemana(d)] += serie[i]; n[diaDaSemana(d)] += 1; });
    for (let w = 0; w < 7; w++) {
      if (n[w]) fator[w] = Math.min(1.5, Math.max(0.5, s[w] / n[w] / mediaSerie));
    }
  }

  const previsao = Array.from({ length: HORIZONTE }, (_, i) => {
    const d = dia(new Date(agora + (i + 1) * DIA_MS));
    return { dia: d, previsto: arred(nivel * fator[diaDaSemana(d)]) };
  });

  const historico = datas.slice(-14).map((d) => ({ dia: d, total: porDia.get(d) ?? 0 }));
  // tendência: últimos 7 dias fechados contra os 7 anteriores
  const ultima = soma(fechados.slice(-7).map((d) => porDia.get(d) ?? 0));
  const anterior = soma(fechados.slice(-14, -7).map((d) => porDia.get(d) ?? 0));
  let variacaoPercentual = null;
  let tendencia = 'estavel';
  if (anterior > 0) {
    variacaoPercentual = arred(((ultima - anterior) / anterior) * 100);
    tendencia = variacaoPercentual > 15 ? 'alta' : variacaoPercentual < -15 ? 'queda' : 'estavel';
  } else if (ultima > 0) {
    tendencia = 'alta';
  }

  const diasComPedido = serie.filter((x) => x > 0).length;
  const confianca =
    diasComPedido >= 14 && totalPedidos >= 20 ? 'alta' : diasComPedido >= 5 && totalPedidos >= 5 ? 'media' : 'baixa';

  const tipos = estoque.itens
    .map((item) => {
      const serieTipo = diasSerie.map((d) => porTipo.get(`${item.comprimentoMm}|${item.bitola}`)?.get(d) ?? 0);
      const consumo = serieTipo.length ? mediaMovelExp(serieTipo) : 0;
      const temConsumo = consumo >= 0.05;
      const diasRestantes = temConsumo ? arred(item.quantidade / consumo) : null;
      let status = 'sem-consumo';
      if (temConsumo) {
        status = item.quantidade === 0 ? 'esgotado' : diasRestantes <= 3 ? 'critico' : diasRestantes <= 7 ? 'atencao' : 'ok';
      }
      return {
        bitola: item.bitola,
        comprimentoMm: item.comprimentoMm,
        estoque: item.quantidade,
        consumoDiario: arred(consumo),
        previstoProximos7Dias: arred(consumo * HORIZONTE),
        diasRestantes,
        esgotaEm: diasRestantes === null ? null : dia(new Date(agora + Math.ceil(diasRestantes) * DIA_MS)),
        reposicaoSugerida14Dias: Math.max(0, Math.ceil(consumo * 14 - item.quantidade)),
        status,
        _tem: temConsumo || item.entradas > 0,
      };
    })
    .filter((t) => t._tem)
    .map(({ _tem, ...t }) => t)
    .sort((a, b) => (a.diasRestantes ?? Infinity) - (b.diasRestantes ?? Infinity));

  return {
    geradoEm: new Date(agora).toISOString(),
    metodo: `média móvel exponencial dos pedidos dos últimos ${JANELA} dias${serie.length >= MIN_DIAS_SEMANA ? ', com ajuste por dia da semana' : ''}`,
    semDados: totalPedidos === 0,
    totalPedidos,
    diasComPedido,
    confianca,
    consumoDiario: arred(nivel),
    previstoProximos7Dias: arred(soma(previsao.map((p) => p.previsto))),
    tendencia,
    variacaoPercentual,
    historico,
    previsao,
    porTipo: tipos,
  };
}
