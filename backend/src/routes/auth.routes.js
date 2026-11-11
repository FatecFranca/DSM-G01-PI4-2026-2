import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validar } from '../middlewares/validate.js';
import { autenticar } from '../middlewares/auth.js';
import { registroSchema, loginSchema, disponibilidadeSchema } from '../utils/schemas.js';
import * as auth from '../services/auth.service.js';
import { previaConvite } from '../services/convite.service.js';

const router = Router();

const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Tente novamente em alguns minutos.', codigo: 'RATE_LIMIT' },
});

router.post('/register', limitador, validar(registroSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await auth.registrar(req.dados));
}));

router.post('/login', limitador, validar(loginSchema), asyncHandler(async (req, res) => {
  res.json(await auth.entrar(req.dados));
}));

// O front chama isto a cada carga/rota protegida: quem valida a sessão é o servidor.
router.get('/me', autenticar, (req, res) => res.json({ usuario: req.usuario }));

// Checagem em tempo real de usuário/e-mail livres no cadastro.
router.get('/disponibilidade', limitador, validar(disponibilidadeSchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await auth.disponibilidade(req.dados));
}));

// Mostra de qual empresa é o convite antes de cadastrar (não consome o código).
router.get('/convite/:codigo', limitador, asyncHandler(async (req, res) => {
  res.json(await previaConvite(req.params.codigo));
}));

export default router;
