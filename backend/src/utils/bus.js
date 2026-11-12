import { EventEmitter } from 'node:events';

/**
 * Barramento interno. Evita dependência circular entre serviços:
 *  - estoque.service     → emite 'estoque:atualizado'
 *  - dispositivo.service → emite 'dispositivo:status'
 *  - sockets/index.js e mqtt.service.js apenas ouvem.
 */
export const bus = new EventEmitter();
