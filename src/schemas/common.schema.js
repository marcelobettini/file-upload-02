import { z } from 'zod';

// Los parámetros de ruta llegan como string: coerce los convierte a número.
export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});
