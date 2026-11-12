// Mesmas regras do backend (backend/src/utils/schemas.js). O servidor sempre revalida.
export const requisitosSenha = {
  tamanho: (v) => v.length >= 8,
  letra: (v) => /[a-zA-ZÀ-ÿ]/.test(v),
  numero: (v) => /\d/.test(v),
};

export const senhaValida = (v) => Object.values(requisitosSenha).every((fn) => fn(v));

export function nivelDaSenha(v) {
  if (!v) return '';
  let pontos = Object.values(requisitosSenha).filter((fn) => fn(v)).length;
  if (v.length >= 12) pontos++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) pontos++;
  if (/[^A-Za-z0-9]/.test(v)) pontos++;
  return pontos <= 3 ? 'fraca' : pontos <= 5 ? 'media' : 'forte';
}

/** Cada validador devolve '' quando o valor está ok. */
export const validadores = {
  codigoConvite: (v) => (v.replace(/[^a-zA-Z0-9]/g, '').length >= 6 ? '' : 'Informe o código de convite.'),
  organizacao: (v) => (v.trim().length >= 2 && v.trim().length <= 80 ? '' : 'Informe o nome da empresa.'),
  nome: (v) => (v.trim().split(/\s+/).filter(Boolean).length >= 2 ? '' : 'Informe nome e sobrenome.'),
  usuario: (v) => (/^[\w.]{3,20}$/.test(v.trim()) ? '' : 'Use 3 a 20 caracteres: letras, números, _ ou ponto.'),
  email: (v) => (/^\S+@\S+\.\S+$/.test(v.trim()) ? '' : 'Informe um e-mail válido.'),
  senha: (v) => (senhaValida(v) ? '' : 'A senha precisa ter 8+ caracteres, uma letra e um número.'),
  confirmar: (v, todos) => (!v ? 'Confirme sua senha.' : v === todos.senha ? '' : 'As senhas não coincidem.'),
};
