import { useCallback, useEffect, useRef, useState } from 'react';
import { api, lerToken } from '../services/api.js';
import { conectarSocket } from '../services/socket.js';

/**
 * Carrega estoque, estatísticas e máquina do servidor e se mantém atualizado via WebSocket:
 *  - estoque:atualizado        → novo estoque (a cada peça contada / pedido)
 *  - evento:novo               → feed das últimas peças
 *  - dispositivo:telemetria    → peso da balança ao vivo (~1x/s)
 *  - dispositivo:status        → online / ligado
 */
export function useEstoqueRealtime() {
  const [estoque, setEstoque] = useState(null);
  const [estatisticas, setEstatisticas] = useState(null);
  const [dispositivo, setDispositivo] = useState(null);
  const [telemetria, setTelemetria] = useState(null); // { peso, estavel, rssi, recebidoEm }
  const [ultimas, setUltimas] = useState([]);
  const [conectado, setConectado] = useState(false);
  const [erro, setErro] = useState('');
  const timer = useRef(null);

  const carregarEstatisticas = useCallback(
    () => api('/estoque/estatisticas').then(setEstatisticas).catch(() => {}),
    []
  );

  useEffect(() => {
    let ativo = true;

    Promise.all([api('/estoque'), api('/dispositivo'), api('/estoque/estatisticas'), api('/eventos', { query: { limite: 8 } })])
      .then(([e, d, s, ev]) => {
        if (!ativo) return;
        setEstoque(e);
        setDispositivo(d.dispositivos[0] ?? null);
        setEstatisticas(s);
        setUltimas(ev.itens.map((x) => ({ id: x._id, comprimentoMm: x.comprimentoMm, bitola: x.bitola, peso: x.peso, valido: x.valido, ocorridoEm: x.ocorridoEm })));
      })
      .catch((e) => ativo && setErro(e.message));

    const socket = conectarSocket(lerToken());
    socket.on('connect', () => setConectado(true));
    socket.on('disconnect', () => setConectado(false));
    socket.on('connect_error', () => setConectado(false));
    socket.on('estoque:atualizado', (e) => {
      setEstoque(e);
      // várias peças seguidas → recalcula as estatísticas uma vez só
      clearTimeout(timer.current);
      timer.current = setTimeout(carregarEstatisticas, 600);
    });
    socket.on('evento:novo', (ev) => setUltimas((l) => [ev, ...l.filter((x) => x.id !== ev.id)].slice(0, 8)));
    socket.on('dispositivo:telemetria', (t) => setTelemetria({ ...t, recebidoEm: Date.now() }));
    socket.on('dispositivo:status', (d) =>
      setDispositivo((atual) => (!atual || atual.deviceId === d.deviceId ? d : atual))
    );

    return () => {
      ativo = false;
      clearTimeout(timer.current);
      socket.disconnect();
    };
  }, [carregarEstatisticas]);

  return { estoque, estatisticas, dispositivo, telemetria, ultimas, conectado, erro };
}
