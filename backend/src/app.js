import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { naoEncontrado, tratarErros } from './middlewares/error.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.trustProxyHops);
app.use(helmet());
app.use(
  cors({
    // apps nativos (Expo) não enviam Origin; navegadores só passam se estiverem na lista
    origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
  })
);
app.use(express.json({ limit: '100kb' }));

app.use('/api', routes);

// Uma única origem para site, API e Socket.IO em produção.
if (env.serveWeb) {
  const webDist = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    // Rotas desconhecidas da API e assets ausentes devem continuar retornando 404.
    if (/^\/(api|socket\.io)(\/|$)/.test(req.path) || /\.[^/]+$/.test(req.path)) return next();
    res.sendFile('index.html', { root: webDist }, (err) => { if (err) next(err); });
  });
}

app.use(naoEncontrado);
app.use(tratarErros);
