import { useCallback, useEffect, useRef, useState } from 'react';
import { api, lerToken } from '../services/api.js';
import { conectarSocket } from '../services/socket.js';

const ROTULOS = {
  estoque: 'Estoque',
  estatisticas: 'Contagem diária',
  previsao: 'Previsão',
  maquinas: 'Máquinas',
  ultimas: 'Últimas peças',
};
const eventoPublico = (x) => ({ ...x, id: x.id ?? x._id });

export function useEstoqueRealtime() {
  const [estoque, setEstoque] = useState(null);
  const [estatisticas, setEstatisticas] = useState(null);
  const [previsao, setPrevisao] = useState(null);
  const [maquinas, setMaquinas] = useState([]);
  const [selecionado, setSelecionado] = useState('');
  const [leituras, setLeituras] = useState({});
  const [ultimas, setUltimas] = useState([]);
  const [conectado, setConectado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erros, setErros] = useState({});
  const [versao, setVersao] = useState(0);
  const timer = useRef(null);
  const atualizar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let ativo = true;
    const controller = new AbortController();
    const revisoes = {};
    const statusRecebidos = new Map();
    setCarregando(true);

    async function buscar(chave, caminho, aplicar, query) {
      const revisao = (revisoes[chave] = (revisoes[chave] ?? 0) + 1);
      try {
        const resultado = await api(caminho, { signal: controller.signal, query });
        if (!ativo || revisoes[chave] !== revisao) return;
        aplicar(resultado);
        setErros((e) => ({ ...e, [chave]: '' }));
      } catch (e) {
        if (ativo && e.name !== 'AbortError' && revisoes[chave] === revisao) {
          setErros((atual) => ({ ...atual, [chave]: e.message }));
        }
      }
    }
    const carregarResumo = () =>
      Promise.all([
        buscar('estatisticas', '/estoque/estatisticas', setEstatisticas),
        buscar('previsao', '/pedidos/previsao', setPrevisao),
      ]);
    const agendarResumo = () => {
      // Limita consultas em rajadas sem adiar indefinidamente durante contagem contínua.
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        carregarResumo();
      }, 800);
    };
    async function carregar() {
      await Promise.all([
        buscar('estoque', '/estoque', setEstoque),
        buscar('maquinas', '/dispositivo', (r) =>
          setMaquinas(r.dispositivos.map((d) => statusRecebidos.get(d.deviceId) ?? d))
        ),
        buscar('ultimas', '/eventos', (r) => setUltimas(r.itens.map(eventoPublico)), { limite: 8 }),
        carregarResumo(),
      ]);
      if (ativo) setCarregando(false);
    }
    carregar();
    const socket = conectarSocket(lerToken());
    socket.on('connect', () => {
      if (!ativo) return;
      setConectado(true);
      carregar(); // Recompõe o estado perdido durante qualquer desconexão.
    });
    socket.on('disconnect', () => ativo && setConectado(false));
    socket.on('connect_error', () => ativo && setConectado(false));
    socket.on('estoque:atualizado', (e) => {
      if (!ativo) return;
      revisoes.estoque = (revisoes.estoque ?? 0) + 1;
      setEstoque(e);
      setErros((atual) => ({ ...atual, estoque: '' }));
      agendarResumo();
    });
    socket.on('pedido:atualizado', agendarResumo);
    socket.on('evento:novo', (ev) => {
      if (!ativo) return;
      revisoes.ultimas = (revisoes.ultimas ?? 0) + 1;
      setUltimas((l) => [ev, ...l.filter((x) => x.id !== ev.id)].slice(0, 8));
    });
    socket.on('dispositivo:telemetria', (t) => {
      if (ativo) setLeituras((l) => ({ ...l, [t.deviceId]: { ...t, recebidoEm: Date.now() } }));
    });
    socket.on('dispositivo:status', (d) => {
      if (!ativo) return;
      statusRecebidos.set(d.deviceId, d);
      setMaquinas((lista) =>
        lista.some((m) => m.deviceId === d.deviceId)
          ? lista.map((m) => (m.deviceId === d.deviceId ? d : m))
          : [...lista, d]
      );
    });
    return () => {
      ativo = false;
      controller.abort();
      clearTimeout(timer.current);
      timer.current = null;
      socket.disconnect();
    };
  }, [versao]);

  const dispositivo = maquinas.find((m) => m.deviceId === selecionado) ?? maquinas[0] ?? null;
  const telemetria = dispositivo ? (leituras[dispositivo.deviceId] ?? null) : null;
  const avisos = Object.entries(erros)
    .filter(([, mensagem]) => mensagem)
    .map(([chave, mensagem]) => `${ROTULOS[chave]}: ${mensagem}`);
  return {
    estoque,
    estatisticas,
    previsao,
    maquinas,
    dispositivo,
    selecionarMaquina: setSelecionado,
    telemetria,
    ultimas,
    conectado,
    carregando,
    erro: erros.estoque ?? '',
    avisos,
    atualizar,
  };
}
