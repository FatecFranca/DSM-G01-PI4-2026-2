import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';

export default function Simulador({ maquinas }) {
  const [simulador, setSimulador] = useState(null);
  const [deviceId, setDeviceId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const alterando = useRef(false);
  const revisao = useRef(0);
  const montado = useRef(false);

  useEffect(() => {
    montado.current = true;
    let consultando = false;
    async function atualizar() {
      if (consultando || alterando.current) return;
      consultando = true;
      const atual = ++revisao.current;
      try {
        const r = await api('/simulador', { timeoutMs: 15000 });
        if (montado.current && atual === revisao.current) { setSimulador(r); setErro(''); }
      } catch (e) {
        if (montado.current && atual === revisao.current) setErro(e.message);
      } finally { consultando = false; }
    }
    atualizar();
    const timer = setInterval(atualizar, 3000);
    window.addEventListener('focus', atualizar);
    return () => {
      montado.current = false;
      revisao.current++;
      clearInterval(timer);
      window.removeEventListener('focus', atualizar);
    };
  }, []);

  const selecionada = simulador?.ativo ? simulador.deviceId : (deviceId || maquinas[0]?.deviceId || '');
  async function alternar() {
    if (alterando.current || !simulador) return;
    alterando.current = true;
    revisao.current++;
    setOcupado(true);
    setErro('');
    try {
      const r = await api('/simulador', { metodo: 'PUT', timeoutMs: 15000, corpo: {
        ativo: !simulador.ativo, ...(!simulador.ativo && { deviceId: selecionada }),
      } });
      if (montado.current) setSimulador(r);
    } catch (e) {
      if (montado.current) setErro(e.message);
    } finally {
      alterando.current = false;
      if (montado.current) setOcupado(false);
    }
  }

  return (
    <section className="painel">
      <h2>Simulador de contagem</h2>
      <p className="app-sub">Gera uma peça de teste por segundo. As contagens são gravadas no estoque e no histórico desta empresa.</p>
      <p role="status">{simulador ? (simulador.ativo ? 'Simulador ligado' : 'Simulador desligado') : erro ? 'Simulador indisponível no momento. Tentando reconectar…' : 'Consultando simulador…'}
        {simulador && ` · ${simulador.contados} peças processadas nesta simulação.`}</p>
      <div className="form-inline alinha-fim">
        <label className="campo-rotulo">Máquina da simulação
          <select value={selecionada} onChange={(e) => setDeviceId(e.target.value)}
            disabled={ocupado || !simulador || simulador.ativo || !simulador.disponivel || !maquinas.length}>
            {!maquinas.length && <option value="">Adicione uma máquina primeiro</option>}
            {maquinas.map((m) => <option key={m.deviceId} value={m.deviceId}>{m.nome}</option>)}
          </select>
        </label>
        <button type="button" className={`btn ${simulador?.ativo ? 'btn-contorno' : 'btn-solido'} btn-sm`}
          disabled={ocupado || !simulador || (!simulador.ativo && (!simulador.disponivel || !selecionada))}
          onClick={alternar}>{ocupado ? 'Aguarde…' : simulador?.ativo ? 'Desligar simulador' : 'Ligar simulador'}</button>
      </div>
      <p className="app-sub">Continua funcionando ao sair desta página. Para ao desligar aqui ou reiniciar o servidor. Não altera o estado físico da máquina.</p>
      {simulador && !simulador.disponivel && <p className="app-sub">A simulação está desabilitada neste ambiente.</p>}
      {(erro || simulador?.erro) && <p className="msg-app erro" role="alert">{erro || simulador.erro}</p>}
    </section>
  );
}
