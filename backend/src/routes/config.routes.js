import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { exigirDono } from '../middlewares/auth.js';
import { validar } from '../middlewares/validate.js';
import { configUpdateSchema } from '../utils/schemas.js';
import { obterConfig, atualizarConfig } from '../services/config.service.js';
import { obterEstoque } from '../services/estoque.service.js';
import { bus } from '../utils/bus.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => res.json(await obterConfig(req.usuario.organizacaoId))));

router.put('/', exigirDono, validar(configUpdateSchema), asyncHandler(async (req, res) => {
  const { organizacaoId } = req.usuario;
  const cfg = await atualizarConfig(organizacaoId, req.dados);
  // o limite mudou: recalcula alertas e avisa a organização
  bus.emit('estoque:atualizado', { organizacaoId, estoque: await obterEstoque(organizacaoId) });
  res.json(cfg);
}));

export default router;
