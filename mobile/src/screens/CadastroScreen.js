import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Logo from '../components/Logo';
import Campo from '../components/Campo';
import Botao from '../components/Botao';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { validadores } from '../utils/validacao';
import { colors } from '../theme/colors';

const VAZIO = { organizacao: '', codigoConvite: '', nome: '', usuario: '', email: '', senha: '', confirmar: '' };
const COMUNS = ['nome', 'usuario', 'email', 'senha', 'confirmar'];

export default function CadastroScreen({ navigation }) {
  const { registrar, entrar } = useAuth();
  const [modo, setModo] = useState('empresa'); // 'empresa' | 'convite'
  const [previa, setPrevia] = useState(null);
  const [v, setV] = useState(VAZIO);
  const [msgs, setMsgs] = useState({});
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const mudar = (k) => (valor) => {
    const novo = { ...v, [k]: valor };
    setV(novo);
    if (msgs[k] !== undefined) setMsgs((m) => ({ ...m, [k]: validadores[k](valor, novo) }));
  };

  const validar = (k) => {
    const msg = validadores[k](v[k], v);
    setMsgs((m) => ({ ...m, [k]: msg }));
    return !msg;
  };

  // pergunta ao servidor se usuário/e-mail estão livres
  const checar = async (k) => {
    if (!validar(k)) return;
    if (k !== 'usuario' && k !== 'email') return;
    try {
      const r = await api('/auth/disponibilidade', { query: { [k]: v[k].trim() } });
      if (r[k] === false) {
        setMsgs((m) => ({ ...m, [k]: k === 'usuario' ? 'Este usuário já está em uso.' : 'Este e-mail já está cadastrado.' }));
      }
    } catch { /* o cadastro final valida no servidor */ }
  };

  // pergunta ao servidor de qual empresa é o convite (sem consumir)
  const conferirConvite = async () => {
    setPrevia(null);
    if (!validar('codigoConvite')) return;
    try {
      setPrevia(await api(`/auth/convite/${encodeURIComponent(v.codigoConvite.trim())}`));
    } catch (e) {
      setMsgs((m) => ({ ...m, codigoConvite: e.campos?.codigoConvite ?? e.message }));
    }
  };

  const trocarModo = (novo) => {
    setModo(novo);
    setErro('');
    setMsgs({});
    setPrevia(null);
  };

  const enviar = async () => {
    setErro('');
    const chaves = [modo === 'empresa' ? 'organizacao' : 'codigoConvite', ...COMUNS];
    const okTodos = chaves.map(validar).every(Boolean);
    if (!okTodos) return;

    setCarregando(true);
    try {
      const dados = {
        ...(modo === 'empresa' ? { organizacao: v.organizacao.trim() } : { codigoConvite: v.codigoConvite.trim() }),
        nome: v.nome.trim(), usuario: v.usuario.trim(), email: v.email.trim(), senha: v.senha,
      };
      await registrar(dados);
      // já entra direto com a conta criada
      await entrar({ identificador: dados.usuario, senha: dados.senha, lembrar: true });
    } catch (e) {
      if (e.campos && Object.keys(e.campos).length) setMsgs((m) => ({ ...m, ...e.campos }));
      setErro(e.message);
      setCarregando(false);
    }
  };

  return (
    <LinearGradient colors={[colors.painel1, colors.painel2]} style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Logo tamanho={28} />
          <Text style={styles.titulo}>Crie sua conta</Text>

          <View style={styles.modos}>
            {[['empresa', 'Criar uma empresa'], ['convite', 'Tenho um convite']].map(([k, rotulo]) => (
              <TouchableOpacity key={k} style={[styles.modo, modo === k && styles.modoAtivo]} onPress={() => trocarModo(k)}
                                accessibilityRole="tab" accessibilityState={{ selected: modo === k }}>
                <Text style={[styles.modoTexto, modo === k && { color: colors.ciano, fontWeight: '600' }]}>{rotulo}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {modo === 'empresa' ? (
            <Campo rotulo="Nome da empresa" value={v.organizacao} onChangeText={mudar('organizacao')} onBlur={() => validar('organizacao')} autoCapitalize="words" maxLength={80} erro={msgs.organizacao} />
          ) : (
            <>
              <Campo rotulo="Código de convite" value={v.codigoConvite} onChangeText={mudar('codigoConvite')} onBlur={conferirConvite} autoCapitalize="characters" maxLength={20} erro={msgs.codigoConvite} />
              {previa && <Text style={styles.previa}>Você vai entrar em {previa.organizacao} como {previa.papel}.</Text>}
            </>
          )}
          <Campo rotulo="Nome completo" value={v.nome} onChangeText={mudar('nome')} onBlur={() => validar('nome')} autoCapitalize="words" textContentType="name" erro={msgs.nome} />
          <Campo rotulo="Usuário" value={v.usuario} onChangeText={mudar('usuario')} onBlur={() => checar('usuario')} maxLength={20} textContentType="username" erro={msgs.usuario} />
          <Campo rotulo="E-mail" value={v.email} onChangeText={mudar('email')} onBlur={() => checar('email')} keyboardType="email-address" textContentType="emailAddress" erro={msgs.email} />
          <Campo rotulo="Senha" senha value={v.senha} onChangeText={mudar('senha')} onBlur={() => validar('senha')} textContentType="newPassword" erro={msgs.senha} />
          <Campo rotulo="Confirmar senha" senha value={v.confirmar} onChangeText={mudar('confirmar')} onBlur={() => validar('confirmar')} textContentType="newPassword" erro={msgs.confirmar} />

          {!!erro && <Text style={styles.erro} accessibilityRole="alert">{erro}</Text>}

          <Botao titulo="Criar conta" aoPressionar={enviar} carregando={carregando} />
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="link">
            <Text style={styles.link}>Já tem conta? Entrar</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40, gap: 14 },
  titulo: { color: colors.texto, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  erro: { color: colors.erro, fontSize: 13, textAlign: 'center' },
  modos: { flexDirection: 'row', borderWidth: 1, borderColor: colors.borda, borderRadius: 999, padding: 4 },
  modo: { flex: 1, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  modoAtivo: { backgroundColor: 'rgba(0,229,255,0.14)' },
  modoTexto: { color: colors.suave, fontSize: 13 },
  previa: { color: colors.ok, fontSize: 12, paddingLeft: 22 },
  link: { color: colors.ciano, fontSize: 14, textAlign: 'center', fontWeight: '600' },
});
