// O ACK do broker tem prazo; não representa confirmação física do ESP32.
// Um timeout não desfaz uma publicação já aceita: não repetir comandos automaticamente.
export function publicarComPrazo(client, topico, payload, opcoes, timeoutMs = 10000) {
  if (!client?.connected) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    const concluir = (ok) => { clearTimeout(timer); resolve(ok); };
    try {
      client.publish(topico, payload, opcoes, (erro) => concluir(!erro));
    } catch {
      concluir(false);
    }
  });
}
