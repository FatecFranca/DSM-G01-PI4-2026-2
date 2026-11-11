import mongoose from 'mongoose';

const faixaSchema = new mongoose.Schema(
  {
    comprimentoMm: { type: Number, required: true },
    bitola: { type: String, required: true },
    media: { type: Number, required: true },
    desvio: { type: Number, required: true },
  },
  { _id: false }
);

// [comprimento, média M2, M3, M4, desvio M2, M3, M4]  (mesma tabela do firmware)
const TABELA_PADRAO = [
  [5, 0.3, 0.55, 0.85, 0.08, 0.08, 0.1],
  [10, 0.6, 1.05, 1.6, 0.1, 0.1, 0.12],
  [15, 0.95, 1.6, 2.4, 0.12, 0.12, 0.15],
  [20, 1.3, 2.2, 3.3, 0.15, 0.15, 0.18],
].flatMap(([c, m2, m3, m4, d2, d3, d4]) => [
  { comprimentoMm: c, bitola: 'M2', media: m2, desvio: d2 },
  { comprimentoMm: c, bitola: 'M3', media: m3, desvio: d3 },
  { comprimentoMm: c, bitola: 'M4', media: m4, desvio: d4 },
]);

/** Regras do sistema: um documento por organização. */
const configSchema = new mongoose.Schema({
  organizacaoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizacao', required: true, unique: true },
  limiteBaixo: { type: Number, default: 5 },
  kDesvios: { type: Number, default: 2 },
  comprimentosMm: { type: [Number], default: [5, 10, 15, 20] },
  bitolas: { type: [String], default: ['M2', 'M3', 'M4'] },
  tabelaPeso: { type: [faixaSchema], default: TABELA_PADRAO },
});

export const Config = mongoose.model('Config', configSchema);
