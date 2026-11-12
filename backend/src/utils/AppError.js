export class AppError extends Error {
  /**
   * @param {number} status  código HTTP
   * @param {string} mensagem  texto seguro para exibir ao usuário
   * @param {{codigo?: string, campos?: Record<string,string>}} [extra]
   */
  constructor(status, mensagem, extra = {}) {
    super(mensagem);
    this.status = status;
    this.codigo = extra.codigo;
    this.campos = extra.campos;
  }
}
