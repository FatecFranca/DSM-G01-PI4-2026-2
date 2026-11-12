import mqtt from 'mqtt';
import { env } from '../config/env.js';
import { bus } from '../utils/bus.js';
import { eventoSchema, statusSchema, telemetriaSchema } from '../utils/schemas.js';
import { registrarEvento } from './estoque.service.js';
import { Dispositivo } from '../models/Dispositivo.js';

/**
 * Tópicos (prefixo configurável em MQTT_TOPIC_PREFIX; <id> = deviceId gerado pelo servidor):
 *   <p>/<id>/evento  ESP32 → backend   {"comp":10,"bitola":"M3","peso":1.07,"valido":true,"token":"..."}
 *   <p>/<id>/status  ESP32 → backend   {"online":true,"ligado":true,"token":"..."}  (retain + LWT)
 *   <p>/<id>/telemetria ESP32 → backend {"peso":1.07,"estavel":true,"rssi":-60,"token":"..."}  (1x/s, não guardada)
 *   <p>/<id>/cmd     backend → ESP32   {"ligado":false} (retain)  ou  {"tara":true} (sem retain)
 *   <p>/<id>/pedido  backend → ESP32   {"id":"...","comp":10,"bitola":"M3","qtd":20}   (sem retain)
 *   <p>/<id>/alerta  backend → ESP32   {"estoqueBaixo":true}                        (retain)
 *
 * Toda mensagem do ESP32 carrega o token da máquina. Sem deviceId + token válidos o
 * backend descarta a mensagem: é assim que cada evento é ligado à organização certa.
 * (Num broker público o token trafega em texto puro; em produção use TLS + usuário/senha no broker.)
 */
let client = null;
const P = env.MQTT_TOPIC_PREFIX;

export const mqttConectado = () => !!client?.connected;

export function iniciarMqtt() {
  if (!env.MQTT_URL) {
    console.warn('⚠️  MQTT_URL vazio: backend rodando sem broker (use POST /api/eventos para simular).');
    return;
  }

  client = mqtt.connect(env.MQTT_URL, {
    username: env.MQTT_USERNAME,
    password: env.MQTT_PASSWORD,
    reconnectPeriod: 5000,
    clientId: `paraflow-backend-${Math.random().toString(16).slice(2, 8)}`,
  });

  client.on('connect', () => {
    console.log(`📡 MQTT conectado em ${env.MQTT_URL} (prefixo "${P}")`);
    client.subscribe([`${P}/+/evento`, `${P}/+/status`], { qos: 1 });
    client.subscribe(`${P}/+/telemetria`, { qos: 0 });
  });
  client.on('reconnect', () => console.log('📡 MQTT reconectando...'));
  client.on('error', (e) => console.error('📡 MQTT erro:', e.message));
  client.on('message', aoReceber);

  // pedido criado: avisa a máquina (ela posiciona o carrossel na gaveta certa)
  bus.on('pedido:criado', ({ deviceId, pedido }) => {
    publicar(`${P}/${deviceId}/pedido`, {
      id: pedido.id, comp: pedido.comprimentoMm, bitola: pedido.bitola, qtd: pedido.quantidade,
    }, { qos: 1, retain: false });
  });

  // quando o estoque de uma organização muda, avisa SÓ as máquinas dela
  bus.on('estoque:atualizado', async ({ organizacaoId, estoque }) => {
    try {
      const ids = await Dispositivo.find({ organizacaoId }).distinct('deviceId');
      for (const id of ids) publicar(`${P}/${id}/alerta`, { estoqueBaixo: estoque.estoqueBaixo });
    } catch (e) {
      console.error('📡 Falha ao publicar alerta:', e.message);
    }
  });
}

async function aoReceber(topico, buffer) {
  const [prefixo, deviceId, tipo] = topico.split('/');
  if (prefixo !== P || !deviceId) return;

  let json;
  try {
    json = JSON.parse(buffer.toString());
  } catch {
    return console.warn(`📡 Payload não-JSON em ${topico}`);
  }

  try {
    // import dinâmico evita dependência circular (dispositivo.service importa este arquivo)
    const { autenticarDispositivo, atualizarStatus } = await import('./dispositivo.service.js');

    const dispositivo = await autenticarDispositivo(deviceId, json?.token);
    if (!dispositivo) {
      return console.warn(`📡 Mensagem rejeitada: máquina "${deviceId}" desconhecida ou token inválido.`);
    }

    if (tipo === 'evento') {
      const r = eventoSchema.safeParse(json); // o schema descarta o campo "token"
      if (!r.success) return console.warn(`📡 Evento inválido de ${deviceId}:`, r.error.issues[0]?.message);
      await registrarEvento({ dispositivo, ...r.data });
    } else if (tipo === 'telemetria') {
      const r = telemetriaSchema.safeParse(json);
      if (r.success) {
        // só repassa ao vivo (WebSocket); não grava no banco
        bus.emit('dispositivo:telemetria', {
          organizacaoId: String(dispositivo.organizacaoId),
          telemetria: { deviceId, ...r.data, em: new Date().toISOString() },
        });
      }
    } else if (tipo === 'status') {
      const r = statusSchema.safeParse(json);
      if (r.success) await atualizarStatus(dispositivo, r.data);
    }
  } catch (e) {
    console.error(`📡 Erro ao processar ${topico}:`, e.message);
  }
}

function publicar(topico, objeto, opcoes = { qos: 1, retain: true }) {
  return new Promise((resolve) => {
    if (!mqttConectado()) return resolve(false);
    client.publish(topico, JSON.stringify(objeto), opcoes, (err) => resolve(!err));
  });
}

export const publicarComando = (deviceId, corpo, retain = true) =>
  publicar(`${P}/${deviceId}/cmd`, corpo, { qos: 1, retain });

export function encerrarMqtt() {
  return new Promise((resolve) => (client ? client.end(false, {}, resolve) : resolve()));
}
