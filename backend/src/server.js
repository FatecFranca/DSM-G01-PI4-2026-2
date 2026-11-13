import http from 'node:http';
import { env } from './config/env.js';
import { app } from './app.js';
import { conectarBanco, desconectarBanco } from './config/db.js';
import { iniciarSockets, fecharSockets } from './sockets/index.js';
import { iniciarMqtt, encerrarMqtt } from './services/mqtt.service.js';
import { simulador } from './services/simulador.service.js';

// sobe o banco, depois HTTP + WebSocket e por fim o MQTT
async function main() {
  await conectarBanco();

  const server = http.createServer(app);
  iniciarSockets(server);
  iniciarMqtt();

  server.listen(env.PORT, () => {
    console.log(`[api] rodando em http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
  });

  const encerrar = async (sinal) => {
    console.log(`\n${sinal} recebido, encerrando...`);
    server.close();
    await simulador.encerrar();
    await Promise.allSettled([fecharSockets(), encerrarMqtt(), desconectarBanco()]);
    process.exit(0);
  };
  process.on('SIGINT', () => encerrar('SIGINT'));
  process.on('SIGTERM', () => encerrar('SIGTERM'));
}

main().catch((e) => {
  console.error('[api] falha ao iniciar:', e.message);
  process.exit(1);
});
