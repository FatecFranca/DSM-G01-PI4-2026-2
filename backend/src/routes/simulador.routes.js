import { Router } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validar } from '../middlewares/validate.js';
import { simuladorSchema } from '../utils/schemas.js';
import { simulador } from '../services/simulador.service.js';

const router = Router();
const resposta = (organizacaoId) => ({ disponivel: env.allowSimulation, ...simulador.status(organizacaoId) });

router.get('/', (req, res) => res.json(resposta(req.usuario.organizacaoId)));
router.put('/', validar(simuladorSchema), asyncHandler(async (req, res) => {
  const { organizacaoId } = req.usuario;
  if (req.dados.ativo) {
    if (!env.allowSimulation) throw new AppError(403, 'Simulação desabilitada neste ambiente.', { codigo: 'SIMULACAO_OFF' });
    await simulador.iniciar(organizacaoId, req.dados.deviceId);
  } else {
    await simulador.parar(organizacaoId);
  }
  res.json(resposta(organizacaoId));
}));

export default router;
