import { z } from 'zod';

// strictObject rechaza campos desconocidos (por ejemplo, intentar editar `id`).
export const createClientSchema = z.strictObject({
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    document_number: z.string().trim().min(1).max(20),
    email: z.email().max(150).nullish(),
    phone: z.string().trim().max(30).nullish(),
});

// PATCH: los mismos campos, todos opcionales, pero al menos uno presente.
export const updateClientSchema = createClientSchema.partial()
    .refine((data) => Object.keys(data).length > 0, { message: 'Debe informarse al menos un campo' });
