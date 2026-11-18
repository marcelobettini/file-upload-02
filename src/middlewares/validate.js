// Fábrica de middlewares: valida req.body (o req.params) con un esquema Zod.
//
// Si los datos son válidos, REEMPLAZA req.body / req.params por el resultado de Zod:
// sin campos de más, con los textos ya recortados (trim) y con los tipos convertidos
// (por ejemplo, `:id` llega de Express como string y el controlador lo recibe como número).
// Así los controladores leen req.body y req.params como siempre, sin saber que hubo validación.
//
// Si no son válidos, schema.parse() lanza un ZodError. Express lo captura y lo envía
// al errorHandler, que responde 400. No hace falta try/catch ni next(err).
export const validate = (schema, source = 'body') => (req, res, next) => {
    req[source] = schema.parse(req[source]);
    next();
};
