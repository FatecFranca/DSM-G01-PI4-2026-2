/**
 * Simula um ESP32 publicando peças no MQTT (sem hardware).
 * Antes, cadastre uma máquina no site (Configurações → Máquinas) e copie o DEVICE_ID e o TOKEN.
 *
 * Uso:  npm run simular -- <deviceId> <token> [quantidade] [intervaloMs]
 * Ex.:  npm run simular -- pf-a1b2c3d4 0123456789abcdef0123456789abcdef 30 300
 */
import 'dotenv/config';
import mqtt from 'mqtt';

const [deviceId, token, qtd, intervaloMs] = process.argv.slice(2);
const url = process.env.MQTT_URL;
if (!url) {
  console.error('Defina MQTT_URL no backend/.env');
  process.exit(1);
}
if (!deviceId || !token) {
  console.error('Uso: npm run simular -- <deviceId> <token> [quantidade] [intervaloMs]');
  process.exit(1);
}

const prefixo = process.env.MQTT_TOPIC_PREFIX || 'paraflow';
const total = Number(qtd) || Infinity;
const intervalo = Number(intervaloMs) || 1000;

const comprimentos = [5, 10, 15, 20];
const bitolas = { M2: 0.3, M3: 0.55, M4: 0.85 }; // peso base em 5 mm
const escolher = (a) => a[Math.floor(Math.random() * a.length)];

const client = mqtt.connect(url, { username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD });

client.on('connect', () => {
  console.log(`Simulando ${deviceId} em ${url}`);
  client.publish(`${prefixo}/${deviceId}/status`, JSON.stringify({ online: true, ligado: true, token }), { retain: true });

  let n = 0;
  const t = setInterval(() => {
    const comp = escolher(comprimentos);
    const bitola = escolher(Object.keys(bitolas));
    const valido = Math.random() > 0.1; // ~10% rejeitadas
    const peso = valido ? +(bitolas[bitola] * (comp / 5) * (1 + (Math.random() - 0.5) * 0.1)).toFixed(2) : 9.9;
    const payload = { comp, bitola: valido ? bitola : null, peso, valido, token };
    client.publish(`${prefixo}/${deviceId}/evento`, JSON.stringify(payload));
    console.log(++n, { comp, bitola: payload.bitola, peso, valido });
    if (n >= total) {
      clearInterval(t);
      setTimeout(() => client.end(), 300);
    }
  }, intervalo);
});

client.on('error', (e) => console.error('MQTT:', e.message));
