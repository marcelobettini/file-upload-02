import { z } from 'zod';

const fields = {
    case_number: z.string().trim().min(1).max(50),
    title: z.string().trim().min(1).max(200),
    description: z.string().nullish(),
    status: z.enum(['OPEN', 'CLOSED']),
    client_id: z.number().int().positive(),
};

// En la creación `description` y `status` son opcionales (status por defecto: OPEN).
export const createCaseSchema = z.object({
    ...fields,
    description: fields.description.optional(),
    status: fields.status.optional(),
}).strict();

export const updateCaseSchema = z.object(fields).partial().strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: 'Debe informarse al menos un campo',
    });
