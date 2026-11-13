import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// gráficos feitos só com View (sem biblioteca nativa), então funcionam no Expo Go sem instalar nada.

const dm = (d) => `${d.slice(8)}/${d.slice(5, 7)}`;
const fmt = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Colunas. dados: [{ dia, valores: [a, b], previsto? }]  series: [{ nome, cor }] */
export function Colunas({ dados, series, altura = 130 }) {
  const max = Math.max(...dados.flatMap((d) => d.valores), 1);
  const passo = dados.length > 14 ? 3 : 2;
  return (
    <View>
      <View style={[styles.colunas, { height: altura + 16 }]}>
        {dados.map((d, i) => (
          <View key={d.dia} style={styles.coluna}>
            <View style={[styles.par, { height: altura }]}>
              {d.valores.map((v, s) => (
                <View
                  key={s}
                  style={[
                    styles.barra,
                    {
                      height: Math.max(v > 0 ? 3 : 0, (v / max) * altura),
                      backgroundColor: d.previsto ? 'transparent' : series[s].cor,
                      borderColor: series[s].cor,
                      borderWidth: d.previsto ? 1.5 : 0,
                      borderStyle: d.previsto ? 'dashed' : 'solid',
                      opacity: d.previsto ? 0.8 : 1,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
      <View style={styles.rotulos}>
        {dados.map((d, i) => (
          <Text key={d.dia} style={styles.rotulo} numberOfLines={1}>{i % passo === 0 ? dm(d.dia) : ''}</Text>
        ))}
      </View>
      <Text style={styles.max}>máx. {fmt(max)}</Text>
    </View>
  );
}

export function Legenda({ itens }) {
  return (
    <View style={styles.legenda}>
      {itens.map((i) => (
        <View key={i.nome} style={styles.legendaItem}>
          <View style={[styles.quadro, { backgroundColor: i.tracejado ? 'transparent' : i.cor, borderColor: i.cor, borderWidth: i.tracejado ? 1.5 : 0, borderStyle: i.tracejado ? 'dashed' : 'solid' }]} />
          <Text style={styles.legendaTexto}>{i.nome}</Text>
        </View>
      ))}
    </View>
  );
}

const PALETA = [colors.ciano, colors.verde, colors.azul, colors.alerta, '#c792ea', colors.erro];

/** Barra única dividida em fatias + legenda (no lugar da rosca). fatias: [{ nome, valor }] */
export function BarraEmpilhada({ fatias }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  return (
    <View>
      <View style={styles.empilhada}>
        {total === 0 ? (
          <View style={{ flex: 1, backgroundColor: colors.borda }} />
        ) : (
          fatias.map((f, i) => (
            <View key={f.nome} style={{ flex: Math.max(f.valor, 0.0001), backgroundColor: PALETA[i % PALETA.length] }} />
          ))
        )}
      </View>
      <View style={{ gap: 6, marginTop: 10 }}>
        {fatias.map((f, i) => (
          <View key={f.nome} style={styles.linhaLegenda}>
            <View style={[styles.quadro, { backgroundColor: PALETA[i % PALETA.length] }]} />
            <Text style={styles.legendaNome}>{f.nome}</Text>
            <Text style={styles.legendaValor}>{fmt(f.valor)}</Text>
            <Text style={styles.legendaPct}>{total ? `${fmt((f.valor / total) * 100)}%` : '0%'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  colunas: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: 1, borderBottomColor: colors.borda },
  coluna: { flex: 1, justifyContent: 'flex-end' },
  par: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 1 },
  barra: { flex: 1, maxWidth: 14, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  rotulos: { flexDirection: 'row', gap: 2, marginTop: 4 },
  rotulo: { flex: 1, color: colors.suave, fontSize: 9, textAlign: 'center' },
  max: { color: colors.suave, fontSize: 10, textAlign: 'right', marginTop: 2 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 8 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quadro: { width: 12, height: 12, borderRadius: 3 },
  legendaTexto: { color: colors.suave, fontSize: 12 },
  empilhada: { flexDirection: 'row', height: 18, borderRadius: 9, overflow: 'hidden', gap: 2 },
  linhaLegenda: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendaNome: { flex: 1, color: colors.texto, fontSize: 14 },
  legendaValor: { color: colors.texto, fontWeight: '700', fontSize: 14 },
  legendaPct: { width: 48, textAlign: 'right', color: colors.suave, fontSize: 12 },
});
