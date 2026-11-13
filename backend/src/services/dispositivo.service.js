import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Dispositivo } from '../models/Dispositivo.js';
import { AppError } from '../utils/AppError.js';
import { bus } from '../utils/bus.js';
import { publicarComando } from './mqtt.service.js';

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const gerarToken = () => crypto.randomBytes(16).toString('hex'); // 32 caracteres

/** Formato público: nunca inclui o hash do token. */
const publico = (d) => ({
  id: String(d._id),
  deviceId: d.deviceId,
  nome: d.nome,
  ligado: d.ligado,
  online: d.online,
  ultimoContato: d.ultimoContato ?? null,
  criadoEm: d.createdAt,
});

const idValido = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, 'Máquina não encontrada.', { codigo: 'NAO_ENCONTRADA' });
};

export async function listarDispositivos(organizacaoId) {
  const lista = await Dispositivo.find({ organizacaoId }).sort({ createdAt: 1 }).lean();
  return lista.map(publico);
}

/** Vincula uma máquina nova à organização. O token aparece uma vez, aqui. */
export async function criarDispositivo(organizacaoId, { nome }) {
  const token = gerarToken();
  const deviceId = `pf-${crypto.randomBytes(4).toString('hex')}`;
  const d = await Dispositivo.create({ organizacaoId, deviceId, nome, tokenHash: hash(token) });
  return { dispositivo: publico(d), token };
}

export async function regenerarToken(organizacaoId, id) {
  idValido(id);
  const token = gerarToken();
  const d = await Dispositivo.findOneAndUpdate(
    { _id: id, organizacaoId },
    { $set: { tokenHash: hash(token), online: false } },
    { new: true }
  );
  if (!d) throw new AppError(404, 'Máquina não encontrada.', { codigo: 'NAO_ENCONTRADA' });
  return { dispositivo: publico(d), token };
}

export async function removerDispositivo(organizacaoId, id) {
  idValido(id);
  const d = await Dispositivo.findOneAndDelete({ _id: id, organizacaoId });
  if (!d) throw new AppError(404, 'Máquina não encontrada.', { codigo: 'NAO_ENCONTRADA' });
}

/** Máquina da organização (a informada, ou a primeira). */
export async function dispositivoDaOrganizacao(organizacaoId, deviceId) {
  const d = await Dispositivo.findOne({ organizacaoId, ...(deviceId && { deviceId }) }).sort({ createdAt: 1 });
  if (!d) {
    throw new AppError(404, 'Nenhuma máquina vinculada. Adicione uma em Configurações > Máquinas.', {
      codigo: 'SEM_MAQUINA',
    });
  }
  return d;
}

/** Máquina para receber um aviso (ex.: pedido): a pedida, senão uma online, senão a primeira. Pode ser null. */
export async function escolherDispositivo(organizacaoId, deviceId) {
  if (deviceId) return Dispositivo.findOne({ organizacaoId, deviceId }).lean();
  return (
    (await Dispositivo.findOne({ organizacaoId, online: true }).sort({ createdAt: 1 }).lean()) ??
    (await Dispositivo.findOne({ organizacaoId }).sort({ createdAt: 1 }).lean())
  );
}

// usado pelo MQTT: confere deviceId e token, devolve o dispositivo ou null
export async function autenticarDispositivo(deviceId, token) {
  if (!deviceId || typeof token !== 'string' || !token) return null;
  const d = await Dispositivo.findOne({ deviceId }).select('+tokenHash');
  if (!d) return null;
  const a = Buffer.from(d.tokenHash, 'hex');
  const b = Buffer.from(hash(token), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? d : null;
}

/** Chamado pelo MQTT quando o ESP32 publica seu status (ou o LWT dispara). */
export async function atualizarStatus(dispositivo, { online, ligado }) {
  const set = { ultimoContato: new Date() };
  if (online !== undefined) set.online = online;
  if (ligado !== undefined) set.ligado = ligado;

  const d = await Dispositivo.findByIdAndUpdate(dispositivo._id, { $set: set }, { new: true }).lean();
  if (!d) return null;
  bus.emit('dispositivo:status', { organizacaoId: String(d.organizacaoId), dispositivo: publico(d) });
  return publico(d);
}

// manda o comando pelo MQTT; quem confirma é o próprio dispositivo, pelo status
export async function enviarComando(organizacaoId, deviceId, { ligado, tara }) {
  const d = await dispositivoDaOrganizacao(organizacaoId, deviceId);
  let ok = true;
  // ligar/desligar fica "retido" no broker (a máquina obedece ao reconectar).
  if (ligado !== undefined) ok = (await publicarComando(d.deviceId, { ligado }, true)) && ok;
  // tara é um gesto pontual: não pode ficar retida, senão zeraria a balança a cada reconexão.
  if (tara) ok = (await publicarComando(d.deviceId, { tara: true }, false)) && ok;
  if (!ok) {
    throw new AppError(503, 'Broker MQTT indisponível. Comando não enviado.', { codigo: 'MQTT_OFFLINE' });
  }
  return { deviceId: d.deviceId, ...(ligado !== undefined && { ligado }), ...(tara && { tara: true }), enviado: true };
}
