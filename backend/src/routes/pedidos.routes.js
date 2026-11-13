import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validar } from '../middlewares/validate.js';
import { pedidoCriarSchema, pedidosQuerySchema } from '../utils/schemas.js';
import * as pedidos from '../services/pedido.service.js';
import { preverPedidos } from '../services/previsao.service.js';

// qualquer usuário da organização (dono ou operador) pode pedir parafusos.
const router = Router();

router.get('/', validar(pedidosQuerySchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await pedidos.listarPedidos(req.usuario.organizacaoId, req.dados));
}));

router.get('/previsao', asyncHandler(async (req, res) => {
  res.json(await preverPedidos(req.usuario.organizacaoId));
}));

router.post('/', validar(pedidoCriarSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ pedido: await pedidos.criarPedido(req.usuario.organizacaoId, req.usuario, req.dados) });
}));

router.post('/:id/retirar', asyncHandler(async (req, res) => {
  res.json({ pedido: await pedidos.marcarRetirado(req.usuario.organizacaoId, req.usuario, req.params.id) });
}));

router.post('/:id/cancelar', asyncHandler(async (req, res) => {
  res.json({ pedido: await pedidos.cancelarPedido(req.usuario.organizacaoId, req.usuario, req.params.id) });
}));

export default router;
