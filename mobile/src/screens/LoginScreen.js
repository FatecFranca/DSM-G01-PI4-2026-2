import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Logo from '../components/Logo';
import Campo from '../components/Campo';
import Botao from '../components/Botao';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function LoginScreen({ navigation }) {
  const { entrar } = useAuth();
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const senhaRef = useRef(null);

  const enviar = async () => {
    if (carregando) return;
    if (!identificador.trim() || !senha) return setErro('Preencha usuário e senha.');
    setErro('');
    setCarregando(true);
    try {
      await entrar({ identificador: identificador.trim(), senha, lembrar });
      // a navegação acontece sozinha: o Navigator troca de pilha quando há usuário
    } catch (e) {
      setErro(e.message);
      setCarregando(false);
    }
  };

  return (
    <LinearGradient colors={[colors.painel1, colors.painel2]} style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Logo />
          <Text style={styles.titulo}>Olá, seja bem-vindo</Text>

          <Campo
            rotulo="Usuário ou e-mail" value={identificador} onChangeText={setIdentificador}
            textContentType="username" returnKeyType="next" onSubmitEditing={() => senhaRef.current?.focus()}
          />
          <Campo
            ref={senhaRef} rotulo="Senha" senha value={senha} onChangeText={setSenha}
            textContentType="password" returnKeyType="done" onSubmitEditing={enviar}
          />

          {!!erro && <Text style={styles.erro} accessibilityRole="alert">{erro}</Text>}

          <TouchableOpacity
            style={styles.lembrar} onPress={() => setLembrar(!lembrar)}
            accessibilityRole="checkbox" accessibilityState={{ checked: lembrar }}
          >
            <View style={[styles.checkbox, lembrar && styles.checkboxAtivo]}>
              {lembrar && <Text style={styles.check}>✓</Text>}
            </View>
            <Text style={styles.opcaoTexto}>Lembrar de mim</Text>
          </TouchableOpacity>

          <Botao titulo="Entrar" aoPressionar={enviar} carregando={carregando} />
          <Botao titulo="Cadastrar" variante="contorno" aoPressionar={() => navigation.navigate('Cadastro')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40, gap: 16 },
  titulo: { color: colors.texto, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  erro: { color: colors.erro, fontSize: 13, textAlign: 'center' },
  lembrar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: colors.suave, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkboxAtivo: { backgroundColor: colors.verde, borderColor: colors.verde },
  check: { color: colors.textoBotao, fontSize: 13, fontWeight: '700', lineHeight: 15 },
  opcaoTexto: { color: colors.texto, fontSize: 13 },
});
