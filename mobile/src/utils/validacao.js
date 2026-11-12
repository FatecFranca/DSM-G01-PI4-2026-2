// Mesmas regras do backend e do web. O servidor sempre revalida.
export const requisitosSenha = {
  tamanho: (v) => v.length >= 8,
  letra: (v) => /[a-zA-ZÀ-ÿ]/.test(v),
  numero: (v) => /\d/.test(v),
};
export const senhaValida = (v) => Object.values(requisitosSenha).every((fn) => fn(v));

export const validadores = {
  codigoConvite: (v) => (v.replace(/[^a-zA-Z0-9]/g, '').length >= 6 ? '' : 'Informe o código de convite.'),
  organizacao: (v) => (v.trim().length >= 2 && v.trim().length <= 80 ? '' : 'Informe o nome da empresa.'),
  nome: (v) => (v.trim().split(/\s+/).filter(Boolean).length >= 2 ? '' : 'Informe nome e sobrenome.'),
  usuario: (v) => (/^[\w.]{3,20}$/.test(v.trim()) ? '' : 'Use 3 a 20 caracteres: letras, números, _ ou ponto.'),
  email: (v) => (/^\S+@\S+\.\S+$/.test(v.trim()) ? '' : 'Informe um e-mail válido.'),
  senha: (v) => (senhaValida(v) ? '' : 'A senha precisa ter 8+ caracteres, uma letra e um número.'),
  confirmar: (v, todos) => (!v ? 'Confirme sua senha.' : v === todos.senha ? '' : 'As senhas não coincidem.'),
};
