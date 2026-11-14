// cliente HTTP único. Em dev o Vite faz proxy de /api -> backend (veja vite.config.js).
const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;
const CHAVE = 'paraflow:token';

export class ApiError extends Error {
  constructor(status, corpo) {
    super(corpo?.erro ?? 'Erro inesperado.');
    this.status = status;
    this.codigo = corpo?.codigo;
    this.campos = corpo?.campos ?? {};
  }
}

/* Token: localStorage se "lembrar de mim", senão sessionStorage (some ao fechar a aba). */
export const lerToken = () => {
  try { return localStorage.getItem(CHAVE) ?? sessionStorage.getItem(CHAVE); } catch { return null; }
};
export const limparToken = () => {
  try { localStorage.removeItem(CHAVE); sessionStorage.removeItem(CHAVE); } catch { /* ignora */ }
};
export const salvarToken = (token, lembrar) => {
  limparToken();
  try { (lembrar ? localStorage : sessionStorage).setItem(CHAVE, token); } catch { /* ignora */ }
};

let aoExpirar = () => {};
export const definirAoExpirar = (fn) => { aoExpirar = fn; };

export async function api(caminho, { metodo = 'GET', corpo, query, signal, timeoutMs = 75000 } = {}) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null))}` : '';
  const token = lerToken();

  const controller = new AbortController();
  let timer;
  let cancelar;
  try {
    const interrupcao = new Promise((_, reject) => {
      cancelar = () => {
        controller.abort();
        reject(new DOMException('Requisição cancelada.', 'AbortError'));
      };
      if (signal?.aborted) { cancelar(); return; }
      signal?.addEventListener('abort', cancelar, { once: true });
      timer = setTimeout(() => {
        controller.abort();
        reject(new ApiError(0, { codigo: 'TEMPO_ESGOTADO', erro: 'O servidor demorou para responder. Aguarde e atualize os dados antes de repetir a ação.' }));
      }, timeoutMs);
    });
    const requisicao = async () => {
      if (controller.signal.aborted) throw new DOMException('Requisição cancelada.', 'AbortError');
      const resp = await fetch(`${BASE}${caminho}${qs}`, {
        method: metodo,
        signal: controller.signal,
        headers: {
          ...(corpo && { 'Content-Type': 'application/json' }),
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      if (controller.signal.aborted) throw new DOMException('Requisição cancelada.', 'AbortError');
      const json = await resp.json().catch((e) => {
        if (controller.signal.aborted) throw e;
        return null;
      });

      if (controller.signal.aborted) throw new DOMException('Requisição cancelada.', 'AbortError');
      if (!resp.ok) {
        // sessão derrubada pelo servidor (token expirado/inválido): limpa e avisa o app
        if (resp.status === 401 && token && caminho !== '/auth/login') {
          limparToken();
          aoExpirar();
        }
        throw new ApiError(resp.status, json);
      }
      return json;
    };
    return await Promise.race([requisicao(), interrupcao]);
  } catch (e) {
    if (e.name === 'AbortError' || e instanceof ApiError) throw e;
    throw new ApiError(0, { erro: 'Não foi possível falar com o servidor. Verifique sua conexão.', codigo: 'REDE' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancelar);
  }
}
