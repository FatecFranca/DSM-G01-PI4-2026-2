import { EventEmitter } from 'node:events';

// barramento interno entre os serviços (evita import circular)
export const bus = new EventEmitter();
