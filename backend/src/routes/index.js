import { Router } from 'express';
import { autenticar, exigirDono } from '../middlewares/auth.js';
import { bancoConectado } from '../config/db.js';
import { mqttConectado } from '../services/mqtt.service.js';
import authRoutes from './auth.routes.js';
import estoqueRoutes from './estoque.routes.js';
import eventosRoutes from './eventos.routes.js';
import configRoutes from './config.routes.js';
import dispositivoRoutes from './dispositivo.routes.js';
import equipeRoutes from './equipe.routes.js';
import pedidosRoutes from './pedidos.routes.js';

const router = Router();

// ---- públicas ----
router.get('/health', (_req, res) => {
  const banco = bancoConectado();
  res.status(banco ? 200 : 503).json({
    status: banco ? 'ok' : 'degradado',
    banco,
    mqtt: mqttConectado(),
    hora: new Date().toISOString(),
  });
});
router.use('/auth', authRoutes);

// ---- protegidas: o servidor valida o token a cada requisição ----
router.use('/estoque', autenticar, estoqueRoutes);
router.use('/eventos', autenticar, eventosRoutes);
router.use('/config', autenticar, configRoutes);
router.use('/dispositivo', autenticar, dispositivoRoutes);
router.use('/pedidos', autenticar, pedidosRoutes);
router.use('/equipe', autenticar, exigirDono, equipeRoutes); // só o dono gerencia a equipe

export default router;
