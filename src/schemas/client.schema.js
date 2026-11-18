import { z } from 'zod';

// .strict() rechaza campos desconocidos (por ejemplo, intentar editar `id`).
const fields = {
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    document_number: z.string().trim().min(1).max(20),
    email: z.email().max(150).nullish(),
    phone: z.string().trim().max(30).nullish(),
};

export const createClientSchema = z.object(fields).strict();

// PATCH: todos los campos opcionales, pero al menos uno presente.
export const updateClientSchema = z.object(fields).partial().strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: 'Debe informarse al menos un campo',
    });
