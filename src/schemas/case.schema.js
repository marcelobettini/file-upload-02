import { z } from 'zod';

// En la creación, `description` y `status` son opcionales (status por defecto: OPEN).
export const createCaseSchema = z.strictObject({
    case_number: z.string().trim().min(1).max(50),
    title: z.string().trim().min(1).max(200),
    description: z.string().nullish(),
    status: z.enum(['OPEN', 'CLOSED']).optional(),
    client_id: z.number().int().positive(),
});

// PATCH: los mismos campos, todos opcionales, pero al menos uno presente.
export const updateCaseSchema = createCaseSchema.partial()
    .refine((data) => Object.keys(data).length > 0, { message: 'Debe informarse al menos un campo' });
