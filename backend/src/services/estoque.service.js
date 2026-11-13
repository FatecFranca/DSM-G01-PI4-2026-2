import mongoose from 'mongoose';
import { Evento } from '../models/Evento.js';
import { Pedido } from '../models/Pedido.js';
import { bus } from '../utils/bus.js';
import { obterConfig } from './config.service.js';
import { resumirContagens } from '../utils/estatisticas.js';
import { AppError } from '../utils/AppError.js';
import { calcularAlertas } from '../utils/alertasEstoque.js';

// em aggregate() o MongoDB não converte string -> ObjectId sozinho (find() converte).
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const TZ = 'America/Sao_Paulo';
const diaSP = (data) => data.toLocaleDateString('en-CA', { timeZone: TZ }); // "2026-11-07"

// estoque = peças válidas contadas menos as de pedidos não cancelados
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
  const alertas = calcularAlertas(itens, cfg.limiteBaixo, totalEntradas);

  // "menos estoque" só considera tipos que já foram contados alguma vez
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
    ...alertas,
    menorEstoque: menores[0] ?? null,
    menores,
    atualizadoEm: new Date().toISOString(),
  };
}

// números do dashboard (os dias seguem o fuso de São Paulo)
export async function obterEstatisticas(organizacaoId) {
  const org = oid(organizacaoId);

  const [porDia, porValidade, retiradas, abertos, retiradosDia] = await Promise.all([
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
      { $group: { _id: '$status', total: { $sum: '$quantidade' } } },
    ]),
    Pedido.countDocuments({ organizacaoId: org, status: 'aberto' }),
    Pedido.aggregate([
      { $match: { organizacaoId: org, status: { $ne: 'cancelado' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, total: { $sum: '$quantidade' } } },
    ]),
  ]);

  const mapa = new Map(porDia.map((d) => [d._id, d.total]));
  const totalContado = porDia.reduce((s, d) => s + d.total, 0);
  const diasAtivos = porDia.length;

  const agora = Date.now();
  const mapaRetirados = new Map(retiradosDia.map((d) => [d._id, d.total]));
  const ultimos14Dias = Array.from({ length: 14 }, (_, i) => {
    const dia = diaSP(new Date(agora - (13 - i) * 24 * 60 * 60 * 1000));
    return { dia, total: mapa.get(dia) ?? 0, retirados: mapaRetirados.get(dia) ?? 0 };
  });
  const ultimos7Dias = ultimos14Dias.slice(-7).map(({ dia, total }) => ({ dia, total }));
  const soma7 = ultimos7Dias.reduce((s, d) => s + d.total, 0);
  const resumo14 = resumirContagens(ultimos14Dias.map((d) => d.total));
  const resumoAtivos = resumirContagens(porDia.map((d) => d.total));

  const validas = porValidade.find((x) => x._id === true)?.total ?? 0;
  const rejeitadas = porValidade.find((x) => x._id === false)?.total ?? 0;
  const arred = (n) => Math.round(n * 10) / 10;

  return {
    hoje: mapa.get(diaSP(new Date(agora))) ?? 0,
    totalContado,
    diasAtivos,
    mediaPorDia: diasAtivos ? arred(totalContado / diasAtivos) : 0, // média nos dias em que houve contagem
    desvioPadraoPorDia: arred(resumoAtivos.desvioPadrao),
    mediaUltimos7Dias: arred(soma7 / 7), // total dos últimos 7 dias ÷ 7 (dias parados contam como 0)
    mediaUltimos14Dias: arred(resumo14.media),
    desvioPadraoUltimos14Dias: arred(resumo14.desvioPadrao),
    contagemDiaria: { periodoDias: 14, tipoDesvio: 'populacional', incluiDiasSemContagem: true, incluiHoje: true, fuso: TZ },
    ultimos7Dias,
    ultimos14Dias,
    pecasRejeitadas: rejeitadas,
    taxaRejeicao: validas + rejeitadas ? arred((rejeitadas / (validas + rejeitadas)) * 100) : 0,
    totalRetirado: retiradas.reduce((total, r) => total + r.total, 0), // compatibilidade: inclui reservas
    totalReservado: retiradas.find((r) => r._id === 'aberto')?.total ?? 0,
    totalRetiradoConfirmado: retiradas.find((r) => r._id === 'retirado')?.total ?? 0,
    pedidosAbertos: abertos,
  };
}

/** Grava a peça (já com a organização da máquina) e notifica quem estiver ouvindo. */
export async function registrarEvento({ dispositivo, comp, bitola, peso, valido }) {
  const organizacaoId = dispositivo.organizacaoId;
  const cfg = await obterConfig(organizacaoId);
  if (!cfg.comprimentosMm.includes(comp) || (valido && !cfg.bitolas.includes(bitola))) {
    throw new AppError(400, 'A peça não corresponde ao catálogo desta empresa.', { codigo: 'CATALOGO_INVALIDO' });
  }
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
