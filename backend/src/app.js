import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { naoEncontrado, tratarErros } from './middlewares/error.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    // apps nativos (Expo) não enviam Origin; navegadores só passam se estiverem na lista
    origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
  })
);
app.use(express.json({ limit: '100kb' }));

app.use('/api', routes);

app.use(naoEncontrado);
app.use(tratarErros);
