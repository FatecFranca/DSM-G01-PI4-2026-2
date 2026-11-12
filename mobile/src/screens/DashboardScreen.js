import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Switch } from 'react-native';
import { io } from 'socket.io-client';
import { StatusBar } from 'expo-status-bar';
import Logo from '../components/Logo';
import Botao from '../components/Botao';
import { useAuth } from '../context/AuthContext';
import { api, API_URL, lerTokenMemoria } from '../services/api';
import { colors } from '../theme/colors';

const fmt = (n) => n.toLocaleString('pt-BR');

export default function DashboardScreen({ navigation }) {
  const { usuario, sair } = useAuth();
  const [estoque, setEstoque] = useState(null);
  const [disp, setDisp] = useState(null);
  const [tempoReal, setTempoReal] = useState(false);
  const [erro, setErro] = useState('');
  const [atualizando, setAtualizando] = useState(false);
  const [est, setEst] = useState(null); // estatísticas
  const [peso, setPeso] = useState(null); // balança ao vivo
  const [, tick] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const [e, d, s] = await Promise.all([api('/estoque'), api('/dispositivo'), api('/estoque/estatisticas')]);
      setEstoque(e);
      setDisp(d.dispositivos[0] ?? null);
      setEst(s);
      setErro('');
    } catch (e) {
      setErro(e.message);
    }
  }, []);

  useEffect(() => {
    carregar();
    const socket = io(API_URL, { auth: { token: lerTokenMemoria() }, transports: ['websocket'] });
    socket.on('connect', () => setTempoReal(true));
    socket.on('disconnect', () => setTempoReal(false));
    socket.on('estoque:atualizado', (e) => {
      setEstoque(e);
      api('/estoque/estatisticas').then(setEst).catch(() => {});
    });
    socket.on('dispositivo:telemetria', (t) => setPeso({ ...t, recebidoEm: Date.now() }));
    const relogio = setInterval(() => tick((n) => n + 1), 1000); // atualiza o "ao vivo"
    socket.on('dispositivo:status', (d) => setDisp((a) => (!a || a.deviceId === d.deviceId ? d : a)));
    return () => { clearInterval(relogio); socket.disconnect(); };
  }, [carregar]);

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
  const maximo = estoque ? Math.max(estoque.limiteBaixo * 4, ...Object.values(estoque.totaisPorBitola), 1) : 1;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={atualizando} onRefresh={puxar} tintColor={colors.ciano} />}>
        <Logo tamanho={26} />
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
              Adicione uma pelo site, em Configurações → Máquinas.
            </Text>
          </View>
        )}

        {estoque?.estoqueBaixo && (
          <View style={styles.alerta}>
            <Text style={styles.alertaTexto}>
              <Text style={{ fontWeight: '700', color: colors.alerta }}>Estoque baixo: </Text>
              {estoque.bitolasBaixas.join(', ')} abaixo de {fmt(estoque.limiteBaixo)} peças.
            </Text>
          </View>
        )}

        <View style={styles.painel}>
          <View style={styles.linhaSwitch}>
            <Text style={styles.painelTitulo}>Separador {disp?.ligado ? 'ligado' : 'desligado'}</Text>
            <Switch value={!!disp?.ligado} disabled={!disp} onValueChange={alternar} trackColor={{ true: colors.verde, false: colors.borda }} />
          </View>
        </View>

        <View style={styles.painel}>
          <Text style={styles.painelTitulo}>Total por bitola</Text>
          {!estoque ? (
            <Text style={styles.suave}>Carregando...</Text>
          ) : (
            bitolas.map((b) => {
              const q = estoque.totaisPorBitola[b];
              const baixo = estoque.bitolasBaixas.includes(b);
              return (
                <View key={b} style={styles.linhaBitola}>
                  <Text style={styles.bitola}>{b}</Text>
                  <View style={styles.barra}>
                    <View style={[styles.barraPreench, { width: `${Math.min(100, (q / maximo) * 100)}%`, backgroundColor: baixo ? colors.alerta : colors.verde }]} />
                  </View>
                  <Text style={[styles.qtd, baixo && { color: colors.alerta }]}>{fmt(q)}</Text>
                </View>
              );
            })
          )}
          {estoque && (
            <View style={styles.totalGeral}>
              <Text style={styles.suave}>Peças em estoque</Text>
              <Text style={styles.totalNumero}>{fmt(estoque.total)}</Text>
            </View>
          )}
        </View>

        <View style={styles.painel}>
          <Text style={styles.painelTitulo}>Resumo</Text>
          {estoque?.menorEstoque ? (
            <Text style={styles.suave}>Menos estoque: <Text style={styles.destaque}>{estoque.menorEstoque.bitola} × {estoque.menorEstoque.comprimentoMm} mm</Text> ({fmt(estoque.menorEstoque.quantidade)} peças)</Text>
          ) : (
            <Text style={styles.suave}>Menos estoque: aparece quando a 1ª peça for contada.</Text>
          )}
          <Text style={styles.suave}>Contadas hoje: <Text style={styles.destaque}>{fmt(est?.hoje ?? 0)}</Text></Text>
          <Text style={styles.suave}>Média por dia: <Text style={styles.destaque}>{(est?.mediaPorDia ?? 0).toLocaleString('pt-BR')}</Text> · últimos 7 dias: <Text style={styles.destaque}>{(est?.mediaUltimos7Dias ?? 0).toLocaleString('pt-BR')}</Text></Text>
          <Text style={styles.suave}>Rejeitadas: {(est?.taxaRejeicao ?? 0).toLocaleString('pt-BR')}% · pedidos abertos: {est?.pedidosAbertos ?? 0}</Text>
          {peso && Date.now() - peso.recebidoEm <= 5000 ? (
            <Text style={styles.suave}>Balança agora: <Text style={styles.destaque}>{peso.peso.toFixed(2)} g</Text> {peso.estavel ? '(estável)' : '(medindo...)'}</Text>
          ) : (
            <Text style={styles.suave}>Balança: sem leitura ao vivo.</Text>
          )}
        </View>

        <Botao titulo="Pedido de parafusos" aoPressionar={() => navigation.navigate('Pedido')} />
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
  painel: { backgroundColor: colors.painel1, borderWidth: 1, borderColor: colors.borda, borderRadius: 20, padding: 20, gap: 14 },
  painelTitulo: { color: colors.texto, fontSize: 16, fontWeight: '600' },
  linhaSwitch: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linhaBitola: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bitola: { width: 36, color: colors.texto, fontWeight: '700' },
  barra: { flex: 1, height: 10, borderRadius: 999, backgroundColor: colors.borda, overflow: 'hidden' },
  barraPreench: { height: '100%', borderRadius: 999 },
  qtd: { width: 56, textAlign: 'right', color: colors.texto, fontWeight: '700', fontVariant: ['tabular-nums'] },
  totalGeral: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, borderTopColor: colors.borda, paddingTop: 14 },
  totalNumero: { color: colors.texto, fontSize: 24, fontWeight: '700' },
  suave: { color: colors.suave },
  destaque: { color: colors.ciano, fontWeight: '700' },
});
