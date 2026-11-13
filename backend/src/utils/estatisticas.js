/** Desvio padrão populacional: a série contém todos os dias do período observado. */
export function resumirContagens(valores) {
  let quantidade = 0;
  let media = 0;
  let somaQuadrados = 0;
  for (const valor of valores) {
    quantidade++;
    const diferenca = valor - media;
    media += diferenca / quantidade;
    somaQuadrados += diferenca * (valor - media);
  }
  return {
    dias: quantidade,
    media,
    desvioPadrao: quantidade ? Math.sqrt(Math.max(0, somaQuadrados / quantidade)) : 0,
  };
}
