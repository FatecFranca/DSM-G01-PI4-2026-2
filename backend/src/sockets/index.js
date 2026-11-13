import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { bus } from '../utils/bus.js';
import { usuarioDoToken } from '../services/auth.service.js';

let io = null;
const sala = (organizacaoId) => `org:${organizacaoId}`;

// webSocket autenticado pelo mesmo JWT; cada conexão entra só na sala da sua organização
export function iniciarSockets(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.corsOrigins } });

  io.use(async (socket, next) => {
    try {
      socket.data.usuario = await usuarioDoToken(socket.handshake.auth?.token ?? '');
      next();
    } catch {
      next(new Error('NAO_AUTENTICADO'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(sala(socket.data.usuario.organizacaoId));
    socket.join(`user:${socket.data.usuario.id}`); // permite derrubar só as conexões de uma pessoa
  });

  // usuário removido da equipe: encerra as conexões em tempo real dele
  bus.on('usuario:removido', ({ usuarioId }) => io.in(`user:${usuarioId}`).disconnectSockets(true));

  bus.on('estoque:atualizado', ({ organizacaoId, estoque, evento }) => {
    const alvo = io.to(sala(organizacaoId));
    alvo.emit('estoque:atualizado', estoque);
    if (estoque.estoqueBaixo) {
      alvo.emit('alerta:estoque-baixo', { bitolas: estoque.bitolasBaixas, tipos: estoque.tiposBaixos, limite: estoque.limiteBaixo });
    }
    if (evento) {
      alvo.emit('evento:novo', {
        id: evento._id.toString(),
        comprimentoMm: evento.comprimentoMm,
        bitola: evento.bitola,
        peso: evento.peso,
        valido: evento.valido,
        ocorridoEm: evento.ocorridoEm,
      });
    }
  });

  bus.on('dispositivo:telemetria', ({ organizacaoId, telemetria }) =>
    io.to(sala(organizacaoId)).emit('dispositivo:telemetria', telemetria)
  );

  bus.on('pedido:atualizado', ({ organizacaoId, pedido }) =>
    io.to(sala(organizacaoId)).emit('pedido:atualizado', pedido)
  );

  bus.on('dispositivo:status', ({ organizacaoId, dispositivo }) =>
    io.to(sala(organizacaoId)).emit('dispositivo:status', dispositivo)
  );

  return io;
}

export const fecharSockets = () => new Promise((resolve) => (io ? io.close(resolve) : resolve()));
