import { AppError } from '../utils/AppError.js';
import { usuarioDoToken } from '../services/auth.service.js';

// confere o token e se o usuário ainda existe no banco
export async function autenticar(req, _res, next) {
  try {
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new AppError(401, 'Não autenticado.', { codigo: 'SEM_TOKEN' });
    req.usuario = await usuarioDoToken(token);
    next();
  } catch (e) {
    next(e);
  }
}

export const exigirDono = (req, _res, next) =>
  req.usuario?.papel === 'dono'
    ? next()
    : next(new AppError(403, 'Apenas o dono da organização pode fazer isso.', { codigo: 'PROIBIDO' }));
