import { criarSimulador } from '../utils/simulador.js';
import { dispositivoDaOrganizacao } from './dispositivo.service.js';
import { obterConfig } from './config.service.js';
import { registrarEvento } from './estoque.service.js';

export const simulador = criarSimulador({ obterDispositivo: dispositivoDaOrganizacao, obterConfig, registrarEvento });
