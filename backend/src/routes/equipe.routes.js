import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validar } from '../middlewares/validate.js';
import { conviteCriarSchema, membroCriarSchema, papelSchema } from '../utils/schemas.js';
import * as equipe from '../services/equipe.service.js';
import * as convites from '../services/convite.service.js';

// Todas as rotas daqui exigem o papel "dono" (aplicado em routes/index.js).
const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { organizacaoId } = req.usuario;
  const [membros, pendentes] = await Promise.all([
    equipe.listarMembros(organizacaoId),
    convites.listarConvites(organizacaoId),
  ]);
  res.json({ membros, convites: pendentes });
}));

router.post('/convites', validar(conviteCriarSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await convites.criarConvite(req.usuario.organizacaoId, req.usuario.id, req.dados));
}));

router.delete('/convites/:id', asyncHandler(async (req, res) => {
  await convites.revogarConvite(req.usuario.organizacaoId, req.params.id);
  res.status(204).end();
}));

router.post('/membros', validar(membroCriarSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ membro: await equipe.criarMembro(req.usuario.organizacaoId, req.dados) });
}));

router.patch('/membros/:id', validar(papelSchema), asyncHandler(async (req, res) => {
  res.json({ membro: await equipe.alterarPapel(req.usuario.organizacaoId, req.params.id, req.dados.papel) });
}));

router.delete('/membros/:id', asyncHandler(async (req, res) => {
  await equipe.removerMembro(req.usuario.organizacaoId, req.usuario.id, req.params.id);
  res.status(204).end();
}));

export default router;
