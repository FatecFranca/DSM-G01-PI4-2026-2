import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export default function Botao({ titulo, aoPressionar, carregando, variante = 'solido', desabilitado }) {
  const contorno = variante === 'contorno';
  return (
    <TouchableOpacity
      style={[styles.base, contorno ? styles.contorno : styles.solido, (carregando || desabilitado) && { opacity: 0.7 }]}
      onPress={aoPressionar}
      activeOpacity={0.85}
      disabled={carregando || desabilitado}
      accessibilityRole="button"
    >
      {carregando ? (
        <ActivityIndicator color={contorno ? colors.azul : colors.textoBotao} />
      ) : (
        <Text style={[styles.texto, contorno && { color: colors.azul }]}>{titulo}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  solido: { backgroundColor: colors.verde },
  contorno: { borderWidth: 2, borderColor: colors.azul },
  texto: { color: colors.textoBotao, fontSize: 16, fontWeight: '700', letterSpacing: 1.5 },
});
