import mongoose from 'mongoose';

// pedido de parafusos: aberto (peças reservadas), retirado ou cancelado (as peças voltam ao estoque)
const pedidoSchema = new mongoose.Schema(
  {
    organizacaoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizacao', required: true },
    solicitanteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    solicitanteNome: { type: String, required: true }, // cópia: o histórico sobrevive se o usuário for removido
    bitola: { type: String, required: true },
    comprimentoMm: { type: Number, required: true },
    quantidade: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['aberto', 'retirado', 'cancelado'], default: 'aberto' },
    deviceId: { type: String, default: null }, // máquina avisada (posiciona o carrossel na gaveta)
    retiradoEm: { type: Date, default: null },
    canceladoEm: { type: Date, default: null },
  },
  { timestamps: true }
);

pedidoSchema.index({ organizacaoId: 1, createdAt: -1 });
pedidoSchema.index({ organizacaoId: 1, status: 1, comprimentoMm: 1, bitola: 1 });

export const Pedido = mongoose.model('Pedido', pedidoSchema);
