import { AppError } from './AppError.js';

// Um loop por empresa, sem processos de terminal, tokens ou intervalos sobrepostos.
export function criarSimulador({ obterDispositivo, obterConfig, registrarEvento,
  agendar = setTimeout, cancelar = clearTimeout, aleatorio = Math.random }) {
  const sessoes = new Map();
  const escolher = (lista) => lista[Math.floor(aleatorio() * lista.length)];
  const status = (organizacaoId) => {
    const s = sessoes.get(String(organizacaoId));
    return { ativo: !!s?.ativo, deviceId: s?.deviceId ?? null,
      contados: s?.contados ?? 0, erro: s?.erro ?? null };
  };

  async function contar(organizacaoId, s) {
    try {
      const dispositivo = await obterDispositivo(organizacaoId, s.deviceId);
      const cfg = await obterConfig(organizacaoId);
      if (!s.ativo) return;
      const comp = escolher(cfg.comprimentosMm);
      const bitola = escolher(cfg.bitolas);
      const faixa = cfg.tabelaPeso.find((f) => f.comprimentoMm === comp && f.bitola === bitola);
      if (!faixa) throw new Error('Catálogo sem referência de peso.');
      const valido = aleatorio() >= 0.1;
      const peso = valido ? Number((faixa.media * (0.95 + aleatorio() * 0.1)).toFixed(2)) : 9.9;
      await registrarEvento({ dispositivo, comp, bitola: valido ? bitola : null, peso, valido });
      s.contados++;
    } catch {
      s.ativo = false;
      s.erro = 'A simulação foi interrompida. Confira a máquina e a conexão e tente ligar novamente.';
    } finally {
      if (s.ativo) programar(organizacaoId, s);
    }
  }

  function programar(organizacaoId, s) {
    s.timer = agendar(() => { s.tarefa = contar(organizacaoId, s); }, 1000);
    s.timer?.unref?.();
  }

  async function iniciar(organizacaoId, deviceId) {
    const chave = String(organizacaoId);
    // Consulta obrigatória e com empresa, mesmo quando já existe uma simulação.
    const dispositivo = await obterDispositivo(organizacaoId, deviceId);
    const atual = sessoes.get(chave);
    if (atual?.parando) throw new AppError(409, 'Aguarde o simulador terminar de desligar.', { codigo: 'SIMULACAO_PARANDO' });
    if (atual?.ativo) {
      if (atual.deviceId !== dispositivo.deviceId) {
        throw new AppError(409, 'Desligue a simulação atual antes de trocar a máquina.', { codigo: 'SIMULACAO_ATIVA' });
      }
      return status(chave);
    }
    const s = { ativo: true, deviceId: dispositivo.deviceId, contados: 0, erro: null };
    sessoes.set(chave, s);
    programar(chave, s);
    return status(chave);
  }

  async function parar(organizacaoId) {
    const chave = String(organizacaoId);
    const s = sessoes.get(chave);
    if (s) {
      s.parando = true;
      s.ativo = false;
      cancelar(s.timer);
      // A resposta confirma que nenhuma gravação ficou em andamento.
      await s.tarefa;
      s.parando = false;
    }
    return status(chave);
  }

  async function encerrar() {
    await Promise.all([...sessoes.keys()].map(parar));
    sessoes.clear();
  }

  return { status, iniciar, parar, encerrar };
}
