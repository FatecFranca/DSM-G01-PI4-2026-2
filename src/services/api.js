// Cliente HTTP único. Em dev o Vite faz proxy de /api → backend (veja vite.config.js).
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

export async function api(caminho, { metodo = 'GET', corpo, query } = {}) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null))}` : '';
  const token = lerToken();

  let resp;
  try {
    resp = await fetch(`${BASE}${caminho}${qs}`, {
      method: metodo,
      headers: {
        ...(corpo && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ApiError(0, { erro: 'Não foi possível falar com o servidor. Verifique sua conexão.', codigo: 'REDE' });
  }

  const json = await resp.json().catch(() => null);

  if (!resp.ok) {
    // sessão derrubada pelo servidor (token expirado/inválido): limpa e avisa o app
    if (resp.status === 401 && token && caminho !== '/auth/login') {
      limparToken();
      aoExpirar();
    }
    throw new ApiError(resp.status, json);
  }
  return json;
}
