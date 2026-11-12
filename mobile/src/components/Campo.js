import React, { forwardRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

/** Campo com rótulo, mensagem de erro e (opcional) botão mostrar/ocultar senha. */
const Campo = forwardRef(function Campo({ rotulo, erro, senha, estilo, ...resto }, ref) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <View style={estilo}>
      <View style={styles.wrap}>
        <TextInput
          ref={ref}
          style={[styles.input, senha && { paddingRight: 90 }, !!erro && styles.inputErro]}
          placeholder={rotulo}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={senha && !mostrar}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={rotulo}
          {...resto}
        />
        {senha && (
          <TouchableOpacity
            style={styles.toggle}
            onPress={() => setMostrar((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <Text style={styles.toggleTexto}>{mostrar ? 'Ocultar' : 'Mostrar'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {!!erro && <Text style={styles.erro}>{erro}</Text>}
    </View>
  );
});

export default Campo;

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
  input: {
    height: 54, borderRadius: 27, backgroundColor: colors.campo, borderWidth: 1,
    borderColor: colors.borda, paddingHorizontal: 22, fontSize: 15, color: '#fff',
  },
  inputErro: { borderColor: colors.erro },
  toggle: { position: 'absolute', right: 8, height: 40, paddingHorizontal: 14, justifyContent: 'center' },
  toggleTexto: { color: colors.suave, fontSize: 13 },
  erro: { color: colors.erro, fontSize: 12, paddingLeft: 22, marginTop: 4 },
});
