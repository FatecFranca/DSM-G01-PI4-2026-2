import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { validar } from '../middlewares/validate.js';
import { eventoSchema, eventosQuerySchema, resumoQuerySchema } from '../utils/schemas.js';
import * as estoque from '../services/estoque.service.js';
import { dispositivoDaOrganizacao } from '../services/dispositivo.service.js';

const router = Router();

router.get('/', validar(eventosQuerySchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await estoque.listarEventos(req.usuario.organizacaoId, req.dados));
}));

router.get('/resumo', validar(resumoQuerySchema, 'query'), asyncHandler(async (req, res) => {
  res.json({ dias: await estoque.resumoDiario(req.usuario.organizacaoId, req.dados) });
}));

// Simulação sem hardware (apenas com ALLOW_SIMULATION=true), usando uma máquina da SUA organização.
router.post('/', validar(eventoSchema), asyncHandler(async (req, res) => {
  if (!env.allowSimulation) {
    throw new AppError(403, 'Simulação desabilitada neste ambiente.', { codigo: 'SIMULACAO_OFF' });
  }
  const dispositivo = await dispositivoDaOrganizacao(req.usuario.organizacaoId, req.body.deviceId);
  const r = await estoque.registrarEvento({ dispositivo, ...req.dados });
  res.status(201).json({ evento: r.evento, estoque: r.estoque });
}));

export default router;
