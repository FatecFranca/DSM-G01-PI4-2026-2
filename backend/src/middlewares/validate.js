/** Valida req[onde] com um schema zod e deixa o resultado em req.dados. */
export const validar = (schema, onde = 'body') => (req, _res, next) => {
  const r = schema.safeParse(req[onde]);
  if (!r.success) return next(r.error); // tratado no middleware de erro
  req.dados = r.data;
  next();
};
