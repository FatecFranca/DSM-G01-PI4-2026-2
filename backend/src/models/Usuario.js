import mongoose from 'mongoose';

const usuarioSchema = new mongoose.Schema(
  {
    organizacaoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizacao', required: true, index: true },
    nome: { type: String, required: true, trim: true, maxlength: 100 },
    usuario: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senhaHash: { type: String, required: true, select: false },
    // dono gerencia máquinas, regras e equipe; operador só opera e consulta
    papel: { type: String, enum: ['dono', 'operador'], default: 'operador' },
  },
  { timestamps: true }
);

export const Usuario = mongoose.model('Usuario', usuarioSchema);
