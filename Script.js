import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const senhaRef = useRef(null);

  const entrar = async () => {
    if (carregando) return;
    if (!usuario.trim() || !senha) {
      setErro('Preencha usuário e senha.');
      return;
    }
    setErro('');
    setCarregando(true);
    try {
      await onLogin?.({ usuario: usuario.trim(), senha, lembrar });
    } catch (e) {
      setErro('Não foi possível entrar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <LinearGradient colors={['#0f2747', '#0a1628']} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.logo}>PARAFUSO</Text>
          <Text style={styles.titulo}>Olá, seja bem-vindo</Text>

          <TextInput
            style={styles.input}
            placeholder="Usuário"
            placeholderTextColor="#6f86a6"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            returnKeyType="next"
            value={usuario}
            onChangeText={setUsuario}
            onSubmitEditing={() => senhaRef.current?.focus()}
            accessibilityLabel="Usuário"
          />

          <View style={styles.senhaWrap}>
            <TextInput
              ref={senhaRef}
              style={[styles.input, styles.inputSenha]}
              placeholder="Senha"
              placeholderTextColor="#6f86a6"
              secureTextEntry={!mostrarSenha}
              textContentType="password"
              returnKeyType="done"
              value={senha}
              onChangeText={setSenha}
              onSubmitEditing={entrar}
              accessibilityLabel="Senha"
            />
            <TouchableOpacity
              style={styles.toggle}
              onPress={() => setMostrarSenha((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            >
              <Text style={styles.toggleTexto}>{mostrarSenha ? 'Ocultar' : 'Mostrar'}</Text>
            </TouchableOpacity>
          </View>

          {!!erro && <Text style={styles.erro} accessibilityRole="alert">{erro}</Text>}

          <View style={styles.opcoes}>
            <TouchableOpacity
              style={styles.lembrar}
              onPress={() => setLembrar(!lembrar)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: lembrar }}
            >
              <View style={[styles.checkbox, lembrar && styles.checkboxAtivo]}>
                {lembrar && <Text style={styles.check}>✓</Text>}
              </View>
              <Text style={styles.opcaoTexto}>Lembrar de mim</Text>
            </TouchableOpacity>

            <TouchableOpacity accessibilityRole="link">
              <Text style={styles.opcaoTexto}>Esqueceu a senha?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.botao, carregando && styles.botaoDesabilitado]}
            onPress={entrar}
            activeOpacity={0.85}
            disabled={carregando}
            accessibilityRole="button"
          >
            {carregando ? (
              <ActivityIndicator color="#04261d" />
            ) : (
              <Text style={styles.botaoTexto}>Entrar</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40, gap: 16 },
  logo: {
    color: '#e8f1fc',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: 12,
  },
  titulo: {
    color: '#e8f1fc',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  input: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#0b1422',
    borderWidth: 1,
    borderColor: '#27406a',
    paddingHorizontal: 22,
    fontSize: 15,
    color: '#fff',
  },
  senhaWrap: { justifyContent: 'center' },
  inputSenha: { paddingRight: 90 },
  toggle: { position: 'absolute', right: 8, height: 40, paddingHorizontal: 14, justifyContent: 'center' },
  toggleTexto: { color: '#9db4d1', fontSize: 13 },
  erro: { color: '#ff8a8a', fontSize: 13, textAlign: 'center' },
  opcoes: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lembrar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#9db4d1',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxAtivo: { backgroundColor: '#1fc99a', borderColor: '#1fc99a' },
  check: { color: '#04261d', fontSize: 13, fontWeight: '700', lineHeight: 15 },
  opcaoTexto: { color: '#e8f1fc', fontSize: 13 },
  botao: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1fc99a',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  botaoDesabilitado: { opacity: 0.7 },
  botaoTexto: { color: '#04261d', fontSize: 16, fontWeight: '700', letterSpacing: 1.5 },
});