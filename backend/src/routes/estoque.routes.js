import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { obterEstoque, obterEstatisticas } from '../services/estoque.service.js';

const router = Router();
router.get('/', asyncHandler(async (req, res) => res.json(await obterEstoque(req.usuario.organizacaoId))));
router.get('/estatisticas', asyncHandler(async (req, res) => res.json(await obterEstatisticas(req.usuario.organizacaoId))));
export default router;
