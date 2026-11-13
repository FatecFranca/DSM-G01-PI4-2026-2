export class AppError extends Error {
  constructor(status, mensagem, extra = {}) {
    super(mensagem);
    this.status = status;
    this.codigo = extra.codigo;
    this.campos = extra.campos;
  }
}
