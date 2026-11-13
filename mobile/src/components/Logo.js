import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export default function Logo({ tamanho = 34 }) {
  return (
    <View style={styles.linha} accessibilityRole="header" accessibilityLabel="Paraflow">
      <Image source={require('../../assets/logo.png')} style={{ width: tamanho * 1.15, height: tamanho * 1.15 }} />
      <Text style={[styles.base, { fontSize: tamanho }]}>
        <Text style={styles.para}>PARA</Text>
        <Text style={styles.flow}>FLOW</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  base: { fontWeight: '800', letterSpacing: 5 },
  para: { color: '#d9f7ff', textShadowColor: 'rgba(0,229,255,0.6)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
  flow: { color: '#dcfff0', textShadowColor: 'rgba(0,255,156,0.6)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
});
