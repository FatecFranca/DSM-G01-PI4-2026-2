import mongoose from 'mongoose';

/** A empresa/organização. Usuários, máquinas, eventos e config pertencem a uma. */
const organizacaoSchema = new mongoose.Schema(
  { nome: { type: String, required: true, trim: true, maxlength: 80 } },
  { timestamps: true }
);

export const Organizacao = mongoose.model('Organizacao', organizacaoSchema);
