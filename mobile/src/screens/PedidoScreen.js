import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { io } from 'socket.io-client';
import { StatusBar } from 'expo-status-bar';
import Botao from '../components/Botao';
import { useAuth } from '../context/AuthContext';
import { api, API_URL, lerTokenMemoria } from '../services/api';
import { colors } from '../theme/colors';

const ROTULO = { aberto: 'Aberto', retirado: 'Retirado', cancelado: 'Cancelado' };
const COR = { aberto: colors.alerta, retirado: colors.ok, cancelado: colors.erro };

function Chips({ opcoes, valor, aoEscolher, formato = (x) => String(x) }) {
  return (
    <View style={styles.chips}>
      {opcoes.map((o) => (
        <TouchableOpacity key={o} style={[styles.chip, valor === o && styles.chipAtivo]} onPress={() => aoEscolher(o)}
                          accessibilityRole="button" accessibilityState={{ selected: valor === o }}>
          <Text style={[styles.chipTexto, valor === o && { color: colors.ciano, fontWeight: '700' }]}>{formato(o)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function PedidoScreen({ navigation }) {
  const { usuario } = useAuth();
  const [config, setConfig] = useState(null);
  const [estoque, setEstoque] = useState(null);
  const [lista, setLista] = useState([]);
  const [bitola, setBitola] = useState(null);
  const [comp, setComp] = useState(null);
  const [qtd, setQtd] = useState('1');
  const [msg, setMsg] = useState({ texto: '', erro: false });
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [c, e, p] = await Promise.all([api('/config'), api('/estoque'), api('/pedidos', { query: { limite: 20 } })]);
      setConfig(c);
      setEstoque(e);
      setLista(p.itens);
      setBitola((b) => b ?? c.bitolas[0]);
      setComp((x) => x ?? c.comprimentosMm[0]);
    } catch (e) {
      setMsg({ texto: e.message, erro: true });
    }
  }, []);

  useEffect(() => {
    carregar();
    const socket = io(API_URL, { auth: { token: lerTokenMemoria() }, transports: ['websocket'] });
    socket.on('pedido:atualizado', carregar); // outros operadores atualizam esta tela na hora
    socket.on('estoque:atualizado', setEstoque);
    return () => socket.disconnect();
  }, [carregar]);

  const disponivel = estoque?.itens.find((i) => i.bitola === bitola && i.comprimentoMm === comp)?.quantidade ?? 0;
  const n = Math.max(0, parseInt(qtd, 10) || 0);
  const ajustar = (d) => setQtd(String(Math.min(Math.max(1, disponivel), Math.max(1, n + d))));

  const pedir = async () => {
    setMsg({ texto: '', erro: false });
    setEnviando(true);
    try {
      await api('/pedidos', { metodo: 'POST', corpo: { bitola, comprimentoMm: comp, quantidade: n } });
      setMsg({ texto: 'Peças reservadas. Confirme a retirada após recolhê-las.', erro: false });
      setQtd('1');
      carregar();
    } catch (e) {
      setMsg({ texto: e.campos?.quantidade ?? e.message, erro: true });
    } finally {
      setEnviando(false);
    }
  };

  const acao = async (p, qual) => {
    try {
      await api(`/pedidos/${p.id}/${qual}`, { metodo: 'POST' });
    } catch (e) {
      setMsg({ texto: e.message, erro: true });
    }
    carregar();
  };

  const cancelar = (p) =>
    Alert.alert('Cancelar pedido?', `${p.quantidade} × ${p.bitola} ${p.comprimentoMm} mm voltam ao estoque.`, [
      { text: 'Não', style: 'cancel' },
      { text: 'Cancelar pedido', style: 'destructive', onPress: () => acao(p, 'cancelar') },
    ]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="link">
          <Text style={styles.voltar}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Pedido de parafusos</Text>

        {!config ? (
          <Text style={styles.suave}>Carregando...</Text>
        ) : (
          <View style={styles.painel}>
            <Text style={styles.rotulo}>Tipo (bitola)</Text>
            <Chips opcoes={config.bitolas} valor={bitola} aoEscolher={setBitola} />
            <Text style={styles.rotulo}>Comprimento</Text>
            <Chips opcoes={config.comprimentosMm} valor={comp} aoEscolher={setComp} formato={(c) => `${c} mm`} />
            <Text style={styles.rotulo}>Quantidade</Text>
            <View style={styles.qtdLinha}>
              <TouchableOpacity style={styles.qtdBotao} onPress={() => ajustar(-1)} accessibilityLabel="Diminuir"><Text style={styles.qtdBotaoTexto}>−</Text></TouchableOpacity>
              <TextInput style={styles.qtdInput} keyboardType="number-pad" value={qtd} onChangeText={(t) => setQtd(t.replace(/\D/g, ''))} accessibilityLabel="Quantidade" />
              <TouchableOpacity style={styles.qtdBotao} onPress={() => ajustar(1)} accessibilityLabel="Aumentar"><Text style={styles.qtdBotaoTexto}>+</Text></TouchableOpacity>
            </View>
            <Text style={styles.suave}>Disponível: {disponivel.toLocaleString('pt-BR')} de {bitola} × {comp} mm</Text>
            <Botao titulo="Fazer pedido" aoPressionar={pedir} carregando={enviando} desabilitado={disponivel === 0 || n < 1} />
          </View>
        )}

        {!!msg.texto && <Text style={[styles.msg, msg.erro && { color: colors.erro }]} accessibilityRole={msg.erro ? 'alert' : undefined}>{msg.texto}</Text>}

        <Text style={styles.subtitulo}>Pedidos recentes</Text>
        {lista.length === 0 && <Text style={styles.suave}>Nenhum pedido ainda.</Text>}
        {lista.map((p) => {
          const pode = p.status === 'aberto' && (usuario.papel === 'dono' || p.solicitante.id === usuario.id);
          return (
            <View key={p.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitulo}>{p.quantidade} × {p.bitola} {p.comprimentoMm} mm</Text>
                <Text style={styles.suave}>{p.solicitante.nome} · {new Date(p.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</Text>
                <Text style={{ color: COR[p.status], fontSize: 12, marginTop: 2 }}>{ROTULO[p.status]}</Text>
              </View>
              {pode && (
                <View style={styles.itemAcoes}>
                  <TouchableOpacity style={styles.mini} onPress={() => acao(p, 'retirar')}><Text style={styles.miniTexto}>Retirei</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.mini, { borderColor: colors.erro }]} onPress={() => cancelar(p)}><Text style={[styles.miniTexto, { color: colors.erro }]}>Cancelar</Text></TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 64, gap: 14 },
  voltar: { color: colors.ciano, fontSize: 15 },
  titulo: { color: colors.texto, fontSize: 22, fontWeight: '700' },
  subtitulo: { color: colors.texto, fontSize: 16, fontWeight: '600', marginTop: 8 },
  painel: { backgroundColor: colors.painel1, borderWidth: 1, borderColor: colors.borda, borderRadius: 20, padding: 20, gap: 12 },
  rotulo: { color: colors.suave, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.borda },
  chipAtivo: { borderColor: colors.ciano, backgroundColor: 'rgba(0,229,255,0.12)' },
  chipTexto: { color: colors.texto, fontSize: 14 },
  qtdLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtdBotao: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.borda, alignItems: 'center', justifyContent: 'center' },
  qtdBotaoTexto: { color: colors.texto, fontSize: 22 },
  qtdInput: { flex: 1, height: 46, borderRadius: 23, backgroundColor: colors.campo, borderWidth: 1, borderColor: colors.borda, color: '#fff', textAlign: 'center', fontSize: 18 },
  msg: { color: colors.ok, textAlign: 'center', fontSize: 13 },
  suave: { color: colors.suave, fontSize: 13 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.painel2, borderWidth: 1, borderColor: colors.borda, borderRadius: 16, padding: 14 },
  itemTitulo: { color: colors.texto, fontWeight: '600', fontSize: 15 },
  itemAcoes: { gap: 6 },
  mini: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.verde, alignItems: 'center' },
  miniTexto: { color: colors.ok, fontSize: 12, fontWeight: '600' },
});
