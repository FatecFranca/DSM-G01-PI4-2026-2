import mongoose from 'mongoose';
import { Pedido } from '../models/Pedido.js';
import { AppError } from '../utils/AppError.js';
import { bus } from '../utils/bus.js';
import { obterConfig } from './config.service.js';
import { obterEstoque } from './estoque.service.js';
import { escolherDispositivo } from './dispositivo.service.js';

const publico = (p) => ({
  id: String(p._id),
  bitola: p.bitola,
  comprimentoMm: p.comprimentoMm,
  quantidade: p.quantidade,
  status: p.status,
  solicitante: { id: String(p.solicitanteId), nome: p.solicitanteNome },
  deviceId: p.deviceId ?? null,
  criadoEm: p.createdAt,
  retiradoEm: p.retiradoEm,
  canceladoEm: p.canceladoEm,
});

// uma fila por organização, para dois pedidos ao mesmo tempo não gastarem o mesmo estoque
// (vale para uma instância só do backend)
const filas = new Map();
function serializar(chave, fn) {
  const anterior = filas.get(chave) ?? Promise.resolve();
  const atual = anterior.catch(() => {}).then(fn);
  filas.set(chave, atual);
  atual.finally(() => { if (filas.get(chave) === atual) filas.delete(chave); }).catch(() => {});
  return atual;
}

const naoEncontrado = () => new AppError(404, 'Pedido não encontrado.', { codigo: 'NAO_ENCONTRADO' });

async function avisarEstoque(organizacaoId) {
  bus.emit('estoque:atualizado', { organizacaoId: String(organizacaoId), estoque: await obterEstoque(organizacaoId) });
}

export function criarPedido(organizacaoId, usuario, { bitola, comprimentoMm, quantidade, deviceId }) {
  return serializar(String(organizacaoId), async () => {
    const cfg = await obterConfig(organizacaoId);
    if (!cfg.bitolas.includes(bitola)) {
      throw new AppError(400, 'Bitola inválida.', { codigo: 'VALIDACAO', campos: { bitola: 'Bitola inválida.' } });
    }
    if (!cfg.comprimentosMm.includes(comprimentoMm)) {
      throw new AppError(400, 'Comprimento inválido.', { codigo: 'VALIDACAO', campos: { comprimentoMm: 'Comprimento inválido.' } });
    }

    const estoque = await obterEstoque(organizacaoId);
    const item = estoque.itens.find((i) => i.bitola === bitola && i.comprimentoMm === comprimentoMm);
    const disponivel = item?.quantidade ?? 0;
    if (quantidade > disponivel) {
      throw new AppError(409, `Estoque insuficiente: só há ${disponivel} de ${bitola} × ${comprimentoMm} mm.`, {
        codigo: 'ESTOQUE_INSUFICIENTE',
        campos: { quantidade: `Só há ${disponivel} em estoque.` },
      });
    }

    const maquina = await escolherDispositivo(organizacaoId, deviceId);
    const pedido = await Pedido.create({
      organizacaoId,
      solicitanteId: usuario.id,
      solicitanteNome: usuario.nome,
      bitola,
      comprimentoMm,
      quantidade,
      deviceId: maquina?.deviceId ?? null,
    });

    const p = publico(pedido);
    bus.emit('pedido:atualizado', { organizacaoId: String(organizacaoId), pedido: p });
    if (maquina) bus.emit('pedido:criado', { organizacaoId: String(organizacaoId), deviceId: maquina.deviceId, pedido: p });
    await avisarEstoque(organizacaoId);
    return p;
  });
}

export async function listarPedidos(organizacaoId, { status, pagina, limite }) {
  const filtro = { organizacaoId, ...(status && { status }) };
  const [itens, total] = await Promise.all([
    Pedido.find(filtro).sort({ createdAt: -1 }).skip((pagina - 1) * limite).limit(limite).lean(),
    Pedido.countDocuments(filtro),
  ]);
  return { itens: itens.map(publico), total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite)) };
}

/** Só o dono ou quem fez o pedido mexe nele. */
async function carregarComPermissao(organizacaoId, usuario, id) {
  if (!mongoose.isValidObjectId(id)) throw naoEncontrado();
  const p = await Pedido.findOne({ _id: id, organizacaoId });
  if (!p) throw naoEncontrado();
  if (usuario.papel !== 'dono' && String(p.solicitanteId) !== usuario.id) {
    throw new AppError(403, 'Só o dono ou quem fez o pedido pode alterá-lo.', { codigo: 'PROIBIDO' });
  }
  return p;
}

async function mudarStatus(organizacaoId, usuario, id, novo) {
  const atual = await carregarComPermissao(organizacaoId, usuario, id);
  if (atual.status !== 'aberto') {
    throw new AppError(409, `Este pedido já foi ${atual.status === 'retirado' ? 'retirado' : 'cancelado'}.`, { codigo: 'STATUS_INVALIDO' });
  }
  const set = novo === 'retirado' ? { status: novo, retiradoEm: new Date() } : { status: novo, canceladoEm: new Date() };
  // filtra por status: se alguém mudou no meio tempo, não sobrescreve
  const p = await Pedido.findOneAndUpdate({ _id: id, organizacaoId, status: 'aberto' }, { $set: set }, { new: true });
  if (!p) throw new AppError(409, 'Este pedido acabou de ser alterado por outra pessoa.', { codigo: 'STATUS_INVALIDO' });

  const pub = publico(p);
  bus.emit('pedido:atualizado', { organizacaoId: String(organizacaoId), pedido: pub });
  if (novo === 'cancelado') await avisarEstoque(organizacaoId); // as peças voltam ao estoque
  return pub;
}

export const marcarRetirado = (org, usuario, id) => mudarStatus(org, usuario, id, 'retirado');
export const cancelarPedido = (org, usuario, id) => mudarStatus(org, usuario, id, 'cancelado');
