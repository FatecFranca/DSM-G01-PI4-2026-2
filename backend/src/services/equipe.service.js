import mongoose from 'mongoose';
import { Usuario } from '../models/Usuario.js';
import { AppError } from '../utils/AppError.js';
import { bus } from '../utils/bus.js';
import { criarUsuario } from './auth.service.js';

const publico = (u) => ({
  id: String(u._id),
  nome: u.nome,
  usuario: u.usuario,
  email: u.email,
  papel: u.papel,
  criadoEm: u.createdAt,
});

const naoEncontrado = () => new AppError(404, 'Usuário não encontrado.', { codigo: 'NAO_ENCONTRADO' });
const idValido = (id) => { if (!mongoose.isValidObjectId(id)) throw naoEncontrado(); };

export async function listarMembros(organizacaoId) {
  const lista = await Usuario.find({ organizacaoId }).sort({ createdAt: 1 }).lean();
  return lista.map(publico);
}

/** O dono cria o usuário diretamente (com senha provisória) dentro da própria organização. */
export async function criarMembro(organizacaoId, { nome, usuario, email, senha, papel }) {
  const u = await criarUsuario({ nome, usuario, email, senha, organizacaoId, papel });
  return publico(u);
}

export async function alterarPapel(organizacaoId, membroId, papel) {
  idValido(membroId);
  const m = await Usuario.findOne({ _id: membroId, organizacaoId });
  if (!m) throw naoEncontrado();

  if (m.papel === 'dono' && papel !== 'dono') {
    const donos = await Usuario.countDocuments({ organizacaoId, papel: 'dono' });
    if (donos <= 1) {
      throw new AppError(400, 'A organização precisa de pelo menos um dono.', { codigo: 'ULTIMO_DONO' });
    }
  }
  m.papel = papel;
  await m.save();
  return publico(m);
}

export async function removerMembro(organizacaoId, atorId, membroId) {
  idValido(membroId);
  if (String(atorId) === String(membroId)) {
    throw new AppError(400, 'Você não pode remover a si mesmo.', { codigo: 'AUTO_REMOCAO' });
  }
  const removido = await Usuario.findOneAndDelete({ _id: membroId, organizacaoId });
  if (!removido) throw naoEncontrado();
  // derruba as conexões em tempo real dessa pessoa (o JWT dela já deixa de valer: o banco não a conhece mais)
  bus.emit('usuario:removido', { usuarioId: String(membroId) });
}
