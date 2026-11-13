import 'dotenv/config';
import { z } from 'zod';

const vazioParaUndefined = (v) => (v === '' ? undefined : v);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  MONGO_URI: z.string().min(1, 'MONGO_URI é obrigatório'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa de ao menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  PUBLIC_URL: z.preprocess(vazioParaUndefined, z.string().url().optional()),
  RENDER_EXTERNAL_URL: z.preprocess(vazioParaUndefined, z.string().url().optional()),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  SERVE_WEB: z.enum(['true', 'false']).default('false'),
  MQTT_URL: z.preprocess(vazioParaUndefined, z.string().optional()),
  MQTT_USERNAME: z.preprocess(vazioParaUndefined, z.string().optional()),
  MQTT_PASSWORD: z.preprocess(vazioParaUndefined, z.string().optional()),
  MQTT_TOPIC_PREFIX: z.string().min(1).default('paraflow'),
  ALLOW_SIMULATION: z.enum(['true', 'false']).default('false'),
});

const resultado = schema.safeParse(process.env);

if (!resultado.success) {
  console.error('[config] variáveis de ambiente inválidas:');
  for (const i of resultado.error.issues) console.error(`  - ${i.path.join('.')}: ${i.message}`);
  process.exit(1);
}

const e = resultado.data;

export const env = {
  ...e,
  isProd: e.NODE_ENV === 'production',
  corsOrigins: [...new Set([...e.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    ...[e.PUBLIC_URL, e.RENDER_EXTERNAL_URL].filter(Boolean).map((url) => new URL(url).origin)])],
  trustProxyHops: e.TRUST_PROXY_HOPS,
  serveWeb: e.SERVE_WEB === 'true' || e.NODE_ENV === 'production',
  allowSimulation: e.ALLOW_SIMULATION === 'true',
};
