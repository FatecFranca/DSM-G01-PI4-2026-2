import http from 'node:http';
import { env } from './config/env.js';
import { app } from './app.js';
import { conectarBanco, desconectarBanco } from './config/db.js';
import { iniciarSockets, fecharSockets } from './sockets/index.js';
import { iniciarMqtt, encerrarMqtt } from './services/mqtt.service.js';

// Ordem de subida: banco → HTTP + WebSocket → MQTT.
// As rotas ficam em src/routes/index.js (montadas em /api pelo app.js).
async function main() {
  await conectarBanco();

  const server = http.createServer(app);
  iniciarSockets(server);
  iniciarMqtt();

  server.listen(env.PORT, () => {
    console.log(`🚀 Paraflow API em http://localhost:${env.PORT}/api  (${env.NODE_ENV})`);
  });

  const encerrar = async (sinal) => {
    console.log(`\n${sinal} recebido, encerrando...`);
    server.close();
    await Promise.allSettled([fecharSockets(), encerrarMqtt(), desconectarBanco()]);
    process.exit(0);
  };
  process.on('SIGINT', () => encerrar('SIGINT'));
  process.on('SIGTERM', () => encerrar('SIGTERM'));
}

main().catch((e) => {
  console.error('❌ Falha ao iniciar:', e.message);
  process.exit(1);
});
