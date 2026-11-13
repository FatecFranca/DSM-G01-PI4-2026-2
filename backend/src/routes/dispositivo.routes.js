import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { exigirDono } from '../middlewares/auth.js';
import { validar } from '../middlewares/validate.js';
import { comandoSchema, dispositivoCriarSchema } from '../utils/schemas.js';
import {
  listarDispositivos, criarDispositivo, regenerarToken, removerDispositivo, enviarComando,
} from '../services/dispositivo.service.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json({ dispositivos: await listarDispositivos(req.usuario.organizacaoId) });
}));

// vincular máquina nova (só o dono). O token volta uma vez nesta resposta.
router.post('/', exigirDono, validar(dispositivoCriarSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await criarDispositivo(req.usuario.organizacaoId, req.dados));
}));

router.post('/comando', validar(comandoSchema), asyncHandler(async (req, res) => {
  const { deviceId, ligado, tara } = req.dados;
  res.status(202).json(await enviarComando(req.usuario.organizacaoId, deviceId, { ligado, tara }));
}));

router.post('/:id/token', exigirDono, asyncHandler(async (req, res) => {
  res.json(await regenerarToken(req.usuario.organizacaoId, req.params.id));
}));

router.delete('/:id', exigirDono, asyncHandler(async (req, res) => {
  await removerDispositivo(req.usuario.organizacaoId, req.params.id);
  res.status(204).end();
}));

export default router;
