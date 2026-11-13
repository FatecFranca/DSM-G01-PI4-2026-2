export function calcularAlertas(itens, limiteBaixo, totalEntradas) {
  // Mantém o silêncio inicial, mas depois avalia cada combinação do catálogo.
  const tiposBaixos = totalEntradas === 0 ? [] : itens
    .filter(({ quantidade }) => quantidade < limiteBaixo)
    .map(({ bitola, comprimentoMm, quantidade }) => ({ bitola, comprimentoMm, quantidade }));
  return {
    tiposBaixos,
    bitolasBaixas: [...new Set(tiposBaixos.map(({ bitola }) => bitola))],
    estoqueBaixo: tiposBaixos.length > 0,
  };
}
