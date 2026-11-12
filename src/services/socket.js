import { io } from 'socket.io-client';

/** WebSocket autenticado com o mesmo JWT; o servidor confirma o usuário no banco. */
export const conectarSocket = (token) =>
  io(import.meta.env.VITE_API_URL || undefined, { auth: { token } });
