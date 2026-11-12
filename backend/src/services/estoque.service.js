import mongoose from 'mongoose';
import { Evento } from '../models/Evento.js';
import { Pedido } from '../models/Pedido.js';
import { bus } from '../utils/bus.js';
import { obterConfig } from './config.service.js';

// Em aggregate() o MongoDB NÃO converte string → ObjectId sozinho (find() converte).
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const TZ = 'America/Sao_Paulo';
const diaSP = (data) => data.toLocaleDateString('en-CA', { timeZone: TZ }); // "2026-11-07"

/**
 * Estoque atual = peças válidas contadas (entradas) − peças de pedidos não cancelados (retiradas).
 * O MongoDB é a fonte da verdade: reiniciar o ESP32 não zera nada.
 */
export async function obterEstoque(organizacaoId) {
  const cfg = await obterConfig(organizacaoId);
  const org = oid(organizacaoId);

  const [ent, ret] = await Promise.all([
    Evento.aggregate([
      { $match: { organizacaoId: org, valido: true } },
      { $group: { _id: { c: '$comprimentoMm', b: '$bitola' }, quantidade: { $sum: 1 } } },
    ]),
    Pedido.aggregate([
      { $match: { organizacaoId: org, status: { $ne: 'cancelado' } } },
      { $group: { _id: { c: '$comprimentoMm', b: '$bitola' }, quantidade: { $sum: '$quantidade' } } },
    ]),
  ]);
  const mapaEnt = new Map(ent.map((a) => [`${a._id.c}|${a._id.b}`, a.quantidade]));
  const mapaRet = new Map(ret.map((a) => [`${a._id.c}|${a._id.b}`, a.quantidade]));

  const totaisPorBitola = Object.fromEntries(cfg.bitolas.map((b) => [b, 0]));
  const itens = [];
  let totalEntradas = 0;
  let totalRetirados = 0;
  for (const comprimentoMm of cfg.comprimentosMm) {
    for (const bitola of cfg.bitolas) {
      const entradas = mapaEnt.get(`${comprimentoMm}|${bitola}`) ?? 0;
      const retirados = mapaRet.get(`${comprimentoMm}|${bitola}`) ?? 0;
      const quantidade = Math.max(0, entradas - retirados);
      itens.push({ comprimentoMm, bitola, quantidade, entradas, retirados });
      totaisPorBitola[bitola] += quantidade;
      totalEntradas += entradas;
      totalRetirados += retirados;
    }
  }

  const total = Object.values(totaisPorBitola).reduce((a, b) => a + b, 0);
  // Só alerta depois que o sistema começou a contar (evita alarme com tudo zerado).
  const bitolasBaixas =
    totalEntradas === 0 ? [] : cfg.bitolas.filter((b) => totaisPorBitola[b] < cfg.limiteBaixo);

  // "Qual parafuso há menos": só entre os tipos que já chegaram ao estoque alguma vez
  // (um tipo que nunca foi contado não é "falta", é um tipo que a empresa não usa).
  const menores = itens
    .filter((i) => i.entradas > 0)
    .sort((a, b) => a.quantidade - b.quantidade || a.comprimentoMm - b.comprimentoMm)
    .slice(0, 3)
    .map(({ comprimentoMm, bitola, quantidade }) => ({ comprimentoMm, bitola, quantidade }));

  return {
    itens,
    totaisPorBitola,
    total,
    totalEntradas,
    totalRetirados,
    limiteBaixo: cfg.limiteBaixo,
    bitolasBaixas,
    estoqueBaixo: bitolasBaixas.length > 0,
    menorEstoque: menores[0] ?? null,
    menores,
    atualizadoEm: new Date().toISOString(),
  };
}

/**
 * Números do dashboard: contagem de hoje, médias por dia, últimos 7 dias, rejeição e pedidos.
 * Os dias seguem o fuso de São Paulo.
 */
export async function obterEstatisticas(organizacaoId) {
  const org = oid(organizacaoId);

  const [porDia, porValidade, retiradas, abertos] = await Promise.all([
    Evento.aggregate([
      { $match: { organizacaoId: org, valido: true } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$ocorridoEm', timezone: TZ } }, total: { $sum: 1 } } },
    ]),
    Evento.aggregate([
      { $match: { organizacaoId: org } },
      { $group: { _id: '$valido', total: { $sum: 1 } } },
    ]),
    Pedido.aggregate([
      { $match: { organizacaoId: org, status: { $ne: 'cancelado' } } },
      { $group: { _id: null, total: { $sum: '$quantidade' } } },
    ]),
    Pedido.countDocuments({ organizacaoId: org, status: 'aberto' }),
  ]);

  const mapa = new Map(porDia.map((d) => [d._id, d.total]));
  const totalContado = porDia.reduce((s, d) => s + d.total, 0);
  const diasAtivos = porDia.length;

  const agora = Date.now();
  const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
    const dia = diaSP(new Date(agora - (6 - i) * 24 * 60 * 60 * 1000));
    return { dia, total: mapa.get(dia) ?? 0 };
  });
  const soma7 = ultimos7Dias.reduce((s, d) => s + d.total, 0);

  const validas = porValidade.find((x) => x._id === true)?.total ?? 0;
  const rejeitadas = porValidade.find((x) => x._id === false)?.total ?? 0;
  const arred = (n) => Math.round(n * 10) / 10;

  return {
    hoje: mapa.get(diaSP(new Date(agora))) ?? 0,
    totalContado,
    diasAtivos,
    mediaPorDia: diasAtivos ? arred(totalContado / diasAtivos) : 0, // média nos dias em que houve contagem
    mediaUltimos7Dias: arred(soma7 / 7), // total dos últimos 7 dias ÷ 7 (dias parados contam como 0)
    ultimos7Dias,
    pecasRejeitadas: rejeitadas,
    taxaRejeicao: validas + rejeitadas ? arred((rejeitadas / (validas + rejeitadas)) * 100) : 0,
    totalRetirado: retiradas[0]?.total ?? 0,
    pedidosAbertos: abertos,
  };
}

/** Grava a peça (já com a organização da máquina) e notifica quem estiver ouvindo. */
export async function registrarEvento({ dispositivo, comp, bitola, peso, valido }) {
  const organizacaoId = dispositivo.organizacaoId;
  const evento = await Evento.create({
    organizacaoId,
    deviceId: dispositivo.deviceId,
    comprimentoMm: comp,
    bitola: valido ? bitola : null,
    peso,
    valido,
  });
  const estoque = await obterEstoque(organizacaoId);
  bus.emit('estoque:atualizado', {
    organizacaoId: String(organizacaoId),
    estoque,
    evento: evento.toObject(),
    deviceId: dispositivo.deviceId,
  });
  return { evento, estoque };
}

export async function listarEventos(organizacaoId, { de, ate, bitola, valido, pagina, limite }) {
  const filtro = { organizacaoId };
  if (de || ate) filtro.ocorridoEm = { ...(de && { $gte: de }), ...(ate && { $lte: ate }) };
  if (bitola) filtro.bitola = bitola;
  if (valido) filtro.valido = valido === 'true';

  const [itens, total] = await Promise.all([
    Evento.find(filtro).sort({ ocorridoEm: -1 }).skip((pagina - 1) * limite).limit(limite).lean(),
    Evento.countDocuments(filtro),
  ]);
  return { itens, total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite)) };
}

/** Peças válidas por dia e bitola (histórico pedido no briefing). */
export async function resumoDiario(organizacaoId, { de, ate }) {
  const match = { organizacaoId: oid(organizacaoId), valido: true };
  if (de || ate) match.ocorridoEm = { ...(de && { $gte: de }), ...(ate && { $lte: ate }) };

  const linhas = await Evento.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          dia: { $dateToString: { format: '%Y-%m-%d', date: '$ocorridoEm', timezone: TZ } },
          bitola: '$bitola',
        },
        quantidade: { $sum: 1 },
      },
    },
    { $sort: { '_id.dia': -1, '_id.bitola': 1 } },
  ]);

  const porDia = new Map();
  for (const l of linhas) {
    const d = porDia.get(l._id.dia) ?? { dia: l._id.dia, total: 0, porBitola: {} };
    d.porBitola[l._id.bitola] = l.quantidade;
    d.total += l.quantidade;
    porDia.set(l._id.dia, d);
  }
  return [...porDia.values()];
}
