import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Convite } from '../models/Convite.js';
import { Organizacao } from '../models/Organizacao.js';
import { AppError } from '../utils/AppError.js';

const DIA_MS = 24 * 60 * 60 * 1000;

// "ab12c-d34ef" e "AB12CD34EF" são o mesmo código
const normalizar = (codigo) => String(codigo).toUpperCase().replace(/[^A-Z0-9]/g, '');
const hash = (codigo) => crypto.createHash('sha256').update(normalizar(codigo)).digest('hex');
const formatar = (c) => `${c.slice(0, 5)}-${c.slice(5)}`;

const invalido = () =>
  new AppError(400, 'Código de convite inválido, expirado ou já usado.', {
    codigo: 'CONVITE_INVALIDO',
    campos: { codigoConvite: 'Código inválido, expirado ou já usado.' },
  });

const publico = (c) => ({ id: String(c._id), papel: c.papel, expiraEm: c.expiraEm, criadoEm: c.createdAt });
const valido = (codigo) => ({ codigoHash: hash(codigo), usadoEm: null, expiraEm: { $gt: new Date() } });

/** Cria o convite. O código completo volta UMA vez, nesta resposta. */
export async function criarConvite(organizacaoId, criadoPor, { papel, dias }) {
  const bruto = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 caracteres
  const c = await Convite.create({
    organizacaoId,
    codigoHash: hash(bruto),
    papel,
    criadoPor,
    expiraEm: new Date(Date.now() + dias * DIA_MS),
  });
  return { convite: publico(c), codigo: formatar(bruto) };
}

export async function listarConvites(organizacaoId) {
  const lista = await Convite.find({ organizacaoId, usadoEm: null, expiraEm: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean();
  return lista.map(publico);
}

export async function revogarConvite(organizacaoId, id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, 'Convite não encontrado.', { codigo: 'NAO_ENCONTRADO' });
  const r = await Convite.deleteOne({ _id: id, organizacaoId, usadoEm: null });
  if (!r.deletedCount) throw new AppError(404, 'Convite não encontrado.', { codigo: 'NAO_ENCONTRADO' });
}

/** Mostra a empresa do convite ANTES do cadastro (sem consumir). */
export async function previaConvite(codigo) {
  const c = await Convite.findOne(valido(codigo)).lean();
  if (!c) throw invalido();
  const org = await Organizacao.findById(c.organizacaoId).lean();
  if (!org) throw invalido();
  return { organizacao: org.nome, papel: c.papel };
}

/** Consome o convite de forma atômica: duas pessoas não conseguem usar o mesmo código. */
export async function consumirConvite(codigo) {
  const c = await Convite.findOneAndUpdate(valido(codigo), { $set: { usadoEm: new Date() } }, { new: true });
  if (!c) throw invalido();
  return c;
}

/** Se o cadastro falhar depois de consumir, devolve o convite. */
export const liberarConvite = (id) =>
  Convite.updateOne({ _id: id }, { $set: { usadoEm: null, usadoPor: null } });

export const marcarUsadoPor = (id, usuarioId) =>
  Convite.updateOne({ _id: id }, { $set: { usadoPor: usuarioId } });
