import mongoose from 'mongoose';

/** Uma máquina (ESP32) vinculada a uma organização. O token só existe em hash. */
const dispositivoSchema = new mongoose.Schema(
  {
    organizacaoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizacao', required: true, index: true },
    deviceId: { type: String, required: true, unique: true, trim: true }, // gerado pelo servidor
    nome: { type: String, default: 'Separador de parafusos', trim: true },
    tokenHash: { type: String, required: true, select: false },
    ligado: { type: Boolean, default: true },
    online: { type: Boolean, default: false },
    ultimoContato: { type: Date },
  },
  { timestamps: true }
);

export const Dispositivo = mongoose.model('Dispositivo', dispositivoSchema);
