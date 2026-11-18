// Fábrica de middlewares: valida req[source] con un esquema Zod.
// Si es válido, reemplaza req[source] por los datos ya limpiados y tipados.
// Si no, lanza ZodError, que el errorHandler convierte en 400.
export const validate = (schema, source = 'body') => (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    // En Express 5 req.params es de solo lectura por getter; se guarda en req.valid.
    req.valid = { ...req.valid, [source]: result.data };
    next();
};
