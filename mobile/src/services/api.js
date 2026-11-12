import * as SecureStore from 'expo-secure-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333';
const CHAVE = 'paraflow_token'; // SecureStore só aceita letras, números, ".", "-" e "_"

export class ApiError extends Error {
  constructor(status, corpo) {
    super(corpo?.erro ?? 'Erro inesperado.');
    this.status = status;
    this.campos = corpo?.campos ?? {};
  }
}

// Token em memória (sempre) + SecureStore (só quando "lembrar de mim").
let tokenMemoria = null;
export const lerTokenMemoria = () => tokenMemoria;

export async function carregarTokenSalvo() {
  tokenMemoria = (await SecureStore.getItemAsync(CHAVE)) ?? null;
  return tokenMemoria;
}
export async function salvarToken(token, lembrar) {
  tokenMemoria = token;
  if (lembrar) await SecureStore.setItemAsync(CHAVE, token);
  else await SecureStore.deleteItemAsync(CHAVE);
}
export async function limparToken() {
  tokenMemoria = null;
  await SecureStore.deleteItemAsync(CHAVE);
}

let aoExpirar = () => {};
export const definirAoExpirar = (fn) => { aoExpirar = fn; };

export async function api(caminho, { metodo = 'GET', corpo, query } = {}) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null))}` : '';
  let resp;
  try {
    resp = await fetch(`${API_URL}/api${caminho}${qs}`, {
      method: metodo,
      headers: {
        ...(corpo && { 'Content-Type': 'application/json' }),
        ...(tokenMemoria && { Authorization: `Bearer ${tokenMemoria}` }),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ApiError(0, { erro: 'Sem conexão com o servidor. Confira EXPO_PUBLIC_API_URL e a rede.' });
  }
  const json = await resp.json().catch(() => null);
  if (!resp.ok) {
    if (resp.status === 401 && tokenMemoria && caminho !== '/auth/login') {
      await limparToken();
      aoExpirar();
    }
    throw new ApiError(resp.status, json);
  }
  return json;
}
