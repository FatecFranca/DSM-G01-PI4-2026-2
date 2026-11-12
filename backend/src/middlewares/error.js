import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export function naoEncontrado(req, _res, next) {
  next(new AppError(404, `Rota não encontrada: ${req.method} ${req.originalUrl}`, { codigo: 'ROTA_INEXISTENTE' }));
}

// eslint-disable-next-line no-unused-vars
export function tratarErros(err, req, res, _next) {
  if (err instanceof ZodError) {
    const campos = {};
    for (const i of err.issues) campos[i.path.join('.') || '_'] ??= i.message;
    return res.status(400).json({ erro: 'Dados inválidos.', codigo: 'VALIDACAO', campos });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ erro: err.message, codigo: err.codigo, campos: err.campos });
  }

  if (err?.code === 11000) {
    const campo = Object.keys(err.keyPattern ?? {})[0] ?? 'registro';
    return res.status(409).json({
      erro: 'Registro já existe.',
      codigo: 'DUPLICADO',
      campos: { [campo]: 'Já está em uso.' },
    });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido.', codigo: 'JSON_INVALIDO' });
  }

  console.error('💥 Erro não tratado:', err);
  res.status(500).json({
    erro: 'Erro interno do servidor.',
    codigo: 'INTERNO',
    ...(env.isProd ? {} : { detalhe: String(err?.message ?? err) }),
  });
}
