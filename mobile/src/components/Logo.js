import React from 'react';
import { Text, StyleSheet } from 'react-native';

export default function Logo({ tamanho = 34 }) {
  return (
    <Text style={[styles.base, { fontSize: tamanho }]} accessibilityRole="header" accessibilityLabel="Paraflow">
      <Text style={styles.para}>PARA</Text>
      <Text style={styles.flow}>FLOW</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { fontWeight: '800', letterSpacing: 6, textAlign: 'center' },
  para: { color: '#d9f7ff', textShadowColor: 'rgba(0,229,255,0.6)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
  flow: { color: '#dcfff0', textShadowColor: 'rgba(0,255,156,0.6)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
});
