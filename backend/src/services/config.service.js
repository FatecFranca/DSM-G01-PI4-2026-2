import { Config } from '../models/Config.js';

/** Config da organização (criada com os valores padrão na primeira chamada). */
export async function obterConfig(organizacaoId) {
  return Config.findOneAndUpdate(
    { organizacaoId },
    { $setOnInsert: { organizacaoId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

export async function atualizarConfig(organizacaoId, campos) {
  await obterConfig(organizacaoId);
  return Config.findOneAndUpdate({ organizacaoId }, { $set: campos }, { new: true }).lean();
}
