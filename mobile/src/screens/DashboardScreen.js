import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Switch } from 'react-native';
import { io } from 'socket.io-client';
import { StatusBar } from 'expo-status-bar';
import Logo from '../components/Logo';
import Botao from '../components/Botao';
import { Colunas, Legenda, BarraEmpilhada } from '../components/Graficos';
import { useAuth } from '../context/AuthContext';
import { api, API_URL, lerTokenMemoria } from '../services/api';
import { colors } from '../theme/colors';

const fmt = (n) => n.toLocaleString('pt-BR');
const fmt1 = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const dm = (d) => `${d.slice(8)}/${d.slice(5, 7)}`;
const ROTULO = { ok: 'Ok', atencao: 'Atenção', critico: 'Crítico', esgotado: 'Esgotado', 'sem-consumo': 'Sem consumo' };
const COR = { ok: colors.ok, atencao: colors.alerta, critico: colors.erro, esgotado: colors.erro, 'sem-consumo': colors.suave };
const TENDENCIA = { alta: 'em alta', queda: 'em queda', estavel: 'estável' };

export default function DashboardScreen({ navigation }) {
  const { usuario, sair } = useAuth();
  const [estoque, setEstoque] = useState(null);
  const [disp, setDisp] = useState(null);
  const [est, setEst] = useState(null);
  const [prev, setPrev] = useState(null);
  const [peso, setPeso] = useState(null);
  const [tempoReal, setTempoReal] = useState(false);
  const [erro, setErro] = useState('');
  const [atualizando, setAtualizando] = useState(false);
  const [, tick] = useState(0);

  const carregarResumo = useCallback(() => {
    api('/estoque/estatisticas').then(setEst).catch(() => {});
    api('/pedidos/previsao').then(setPrev).catch(() => {});
  }, []);

  const carregar = useCallback(async () => {
    try {
      const [e, d] = await Promise.all([api('/estoque'), api('/dispositivo')]);
      setEstoque(e);
      setDisp(d.dispositivos[0] ?? null);
      setErro('');
      carregarResumo();
    } catch (e) {
      setErro(e.message);
    }
  }, [carregarResumo]);

  useEffect(() => {
    carregar();
    const socket = io(API_URL, { auth: { token: lerTokenMemoria() }, transports: ['websocket'] });
    socket.on('connect', () => setTempoReal(true));
    socket.on('disconnect', () => setTempoReal(false));
    socket.on('estoque:atualizado', (e) => {
      setEstoque(e);
      carregarResumo();
    });
    socket.on('dispositivo:telemetria', (t) => setPeso({ ...t, recebidoEm: Date.now() }));
    socket.on('dispositivo:status', (d) => setDisp((a) => (!a || a.deviceId === d.deviceId ? d : a)));
    const relogio = setInterval(() => tick((n) => n + 1), 1000);
    return () => { clearInterval(relogio); socket.disconnect(); };
  }, [carregar, carregarResumo]);

  // ao voltar da tela de pedidos, atualiza
  useEffect(() => navigation.addListener('focus', carregar), [navigation, carregar]);

  const puxar = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const alternar = async (ligado) => {
    try {
      await api('/dispositivo/comando', { metodo: 'POST', corpo: { deviceId: disp?.deviceId, ligado } });
    } catch (e) {
      setErro(e.message);
    }
  };

  const bitolas = estoque ? Object.keys(estoque.totaisPorBitola) : [];
  const dias14 = est?.ultimos14Dias ?? [];
  const barrasPrevisao = prev && !prev.semDados
    ? [
        ...prev.historico.map((h) => ({ dia: h.dia, valores: [h.total] })),
        ...prev.previsao.map((p) => ({ dia: p.dia, valores: [p.previsto], previsto: true })),
      ]
    : [];
  const aoVivo = peso && Date.now() - peso.recebidoEm <= 5000;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={atualizando} onRefresh={puxar} tintColor={colors.ciano} />}>
        <Logo tamanho={24} />
        <Text style={styles.saudacao}>Olá, {usuario?.nome?.split(' ')[0]}</Text>
        <Text style={[styles.suave, { textAlign: 'center' }]}>{usuario?.organizacao?.nome}</Text>

        <View style={styles.pilulas}>
          <Text style={[styles.pilula, tempoReal && styles.pilulaOn]}>{tempoReal ? '● Tempo real' : '○ Sem tempo real'}</Text>
          <Text style={[styles.pilula, disp?.online && styles.pilulaOn]}>{disp?.online ? '● Dispositivo online' : '○ Dispositivo offline'}</Text>
        </View>

        {!!erro && <Text style={styles.erro} accessibilityRole="alert">{erro}</Text>}

        {estoque && !disp && (
          <View style={styles.alerta}>
            <Text style={styles.alertaTexto}>
              <Text style={{ fontWeight: '700', color: colors.alerta }}>Nenhuma máquina vinculada. </Text>
              Adicione uma pelo site, em Configurações &gt; Máquinas.
            </Text>
          </View>
        )}

        {estoque?.estoqueBaixo && (
          <View style={styles.alerta}>
            <Text style={styles.alertaTexto}>
              <Text style={{ fontWeight: '700', color: colors.alerta }}>Estoque baixo: </Text>
              {(estoque.tiposBaixos ?? []).map((i) => `${i.bitola} ${i.comprimentoMm} mm (${fmt(i.quantidade)})`).join(', ')} abaixo de {fmt(estoque.limiteBaixo)} peças.
            </Text>
          </View>
        )}

        <Botao titulo="Pedido de parafusos" aoPressionar={() => navigation.navigate('Pedido')} />

        <View style={styles.painel}>
          <View style={styles.linhaSwitch}>
            <Text style={styles.painelTitulo}>Separador {disp?.ligado ? 'ligado' : 'desligado'}</Text>
            <Switch value={!!disp?.ligado} disabled={!disp} onValueChange={alternar} trackColor={{ true: colors.verde, false: colors.borda }} />
          </View>
          <Text style={styles.suave}>
            {aoVivo
              ? `Balança agora: ${peso.peso.toFixed(2)} g ${peso.estavel ? '(estável)' : '(medindo)'}`
              : 'Balança: sem leitura ao vivo.'}
          </Text>
        </View>

        <View style={styles.indicadores}>
          <View style={[styles.indicador, styles.indicadorLargo]}>
            <Text style={styles.indRotulo}>Parafuso com menos estoque</Text>
            {estoque?.menorEstoque ? (
              <>
                <Text style={styles.indValorDestaque}>{estoque.menorEstoque.bitola} × {estoque.menorEstoque.comprimentoMm} mm</Text>
                <Text style={styles.suave}>{fmt(estoque.menorEstoque.quantidade)} peças restantes</Text>
              </>
            ) : (
              <Text style={styles.suave}>Aparece quando a primeira peça for contada.</Text>
            )}
          </View>
          <View style={styles.indicador}><Text style={styles.indRotulo}>Hoje</Text><Text style={styles.indValor}>{fmt(est?.hoje ?? 0)}</Text><Text style={styles.suave}>peças</Text></View>
          <View style={styles.indicador}><Text style={styles.indRotulo}>Média por dia</Text><Text style={styles.indValor}>{fmt1(est?.mediaPorDia ?? 0)}</Text><Text style={styles.suave}>{est?.diasAtivos ?? 0} dia(s)</Text></View>
          <View style={styles.indicador}><Text style={styles.indRotulo}>Média 14 dias</Text><Text style={styles.indValor}>{est ? fmt1(est.mediaUltimos14Dias) : '—'}</Text><Text style={styles.suave}>peças/dia · inclui dias zerados</Text></View>
          <View style={styles.indicador}><Text style={styles.indRotulo}>Desvio padrão · 14 dias</Text><Text style={styles.indValor}>{est ? fmt1(est.desvioPadraoUltimos14Dias) : '—'}</Text><Text style={styles.suave}>peças/dia · inclui hoje em andamento</Text></View>
          <View style={styles.indicador}><Text style={styles.indRotulo}>Rejeitadas</Text><Text style={styles.indValor}>{fmt1(est?.taxaRejeicao ?? 0)}%</Text><Text style={styles.suave}>{fmt(est?.pecasRejeitadas ?? 0)} peças</Text></View>
        </View>

        <View style={styles.painel}>
          <Text style={styles.painelTitulo}>Estoque por bitola</Text>
          {!estoque ? (
            <Text style={styles.suave}>Carregando...</Text>
          ) : (
            <BarraEmpilhada fatias={bitolas.map((b) => ({ nome: b, valor: estoque.totaisPorBitola[b] }))} />
          )}
          {estoque && (
            <View style={styles.totalGeral}>
              <Text style={styles.suave}>Peças em estoque</Text>
              <Text style={styles.totalNumero}>{fmt(estoque.total)}</Text>
            </View>
          )}
        </View>

        <View style={styles.painel}>
          <Text style={styles.painelTitulo}>Previsão de pedidos</Text>
          {!prev || prev.semDados ? (
            <Text style={styles.suave}>Ainda não há pedidos para prever. Depois dos primeiros pedidos, a previsão dos próximos 7 dias aparece aqui.</Text>
          ) : (
            <>
              <Text style={styles.suave}>
                Consumo previsto: <Text style={styles.destaque}>{fmt1(prev.consumoDiario)}</Text> peças por dia, <Text style={styles.destaque}>{fmt1(prev.previstoProximos7Dias)}</Text> nos próximos 7 dias. Pedidos {TENDENCIA[prev.tendencia]}
                {prev.variacaoPercentual != null ? ` (${prev.variacaoPercentual > 0 ? '+' : ''}${fmt1(prev.variacaoPercentual)}%)` : ''}. Confiança {prev.confianca}.
              </Text>
              <Legenda itens={[{ nome: 'Pedidos feitos', cor: colors.alerta }, { nome: 'Previsto', cor: colors.alerta, tracejado: true }]} />
              <Colunas dados={barrasPrevisao} series={[{ nome: 'Pedidos', cor: colors.alerta }]} />
              <Text style={styles.subtitulo}>Quando cada tipo deve acabar</Text>
              {prev.porTipo.slice(0, 5).map((t) => (
                <View key={`${t.bitola}-${t.comprimentoMm}`} style={styles.linhaTipo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tipoNome}>{t.bitola} × {t.comprimentoMm} mm</Text>
                    <Text style={styles.suave}>
                      {fmt(t.estoque)} em estoque, {fmt1(t.consumoDiario)}/dia
                      {t.diasRestantes != null ? `, dura ${fmt1(t.diasRestantes)} dias (até ${dm(t.esgotaEm)})` : ''}
                    </Text>
                    {t.reposicaoSugerida14Dias > 0 && <Text style={styles.suave}>Repor {fmt(t.reposicaoSugerida14Dias)} para 14 dias</Text>}
                  </View>
                  <Text style={[styles.chip, { color: COR[t.status], borderColor: COR[t.status] }]}>{ROTULO[t.status]}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.painel}>
          <Text style={styles.painelTitulo}>Entradas e retiradas por dia</Text>
          <Legenda itens={[{ nome: 'Peças contadas', cor: colors.verde }, { nome: 'Retiradas em pedidos', cor: colors.alerta }]} />
          <Colunas dados={dias14.map((d) => ({ dia: d.dia, valores: [d.total, d.retirados] }))} series={[{ nome: 'Contadas', cor: colors.verde }, { nome: 'Retiradas', cor: colors.alerta }]} />
        </View>

        <Botao titulo="Sair" variante="contorno" aoPressionar={sair} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 64, gap: 16 },
  saudacao: { color: colors.texto, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  pilulas: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  pilula: { color: colors.suave, fontSize: 12, borderWidth: 1, borderColor: colors.borda, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  pilulaOn: { color: colors.ok, borderColor: colors.verde },
  erro: { color: colors.erro, textAlign: 'center', fontSize: 13 },
  alerta: { borderLeftWidth: 4, borderLeftColor: colors.alerta, backgroundColor: 'rgba(255,200,87,0.08)', borderRadius: 12, padding: 14 },
  alertaTexto: { color: colors.texto, fontSize: 14 },
  painel: { backgroundColor: colors.painel1, borderWidth: 1, borderColor: colors.borda, borderRadius: 20, padding: 20, gap: 12 },
  painelTitulo: { color: colors.texto, fontSize: 16, fontWeight: '600' },
  subtitulo: { color: colors.texto, fontSize: 14, fontWeight: '600', marginTop: 8 },
  linhaSwitch: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  indicadores: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  indicador: { flexGrow: 1, flexBasis: '30%', backgroundColor: colors.painel2, borderWidth: 1, borderColor: colors.borda, borderRadius: 16, padding: 14, gap: 2 },
  indicadorLargo: { flexBasis: '100%', borderColor: colors.ciano },
  indRotulo: { color: colors.suave, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
  indValor: { color: colors.texto, fontSize: 22, fontWeight: '700' },
  indValorDestaque: { color: colors.ciano, fontSize: 24, fontWeight: '700' },
  totalGeral: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, borderTopColor: colors.borda, paddingTop: 14 },
  totalNumero: { color: colors.texto, fontSize: 24, fontWeight: '700' },
  linhaTipo: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.borda, paddingTop: 10 },
  tipoNome: { color: colors.texto, fontWeight: '600', fontSize: 15 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, fontSize: 11, fontWeight: '600', overflow: 'hidden' },
  suave: { color: colors.suave, fontSize: 13 },
  destaque: { color: colors.ciano, fontWeight: '700' },
});
