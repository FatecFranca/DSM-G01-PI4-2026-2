import mongoose from 'mongoose';

/** Convite para entrar numa organização. O código só existe em hash (aparece 1x ao criar). */
const conviteSchema = new mongoose.Schema(
  {
    organizacaoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizacao', required: true, index: true },
    codigoHash: { type: String, required: true, unique: true },
    papel: { type: String, enum: ['operador', 'dono'], default: 'operador' },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    expiraEm: { type: Date, required: true },
    usadoEm: { type: Date, default: null },
    usadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  },
  { timestamps: true }
);

export const Convite = mongoose.model('Convite', conviteSchema);
