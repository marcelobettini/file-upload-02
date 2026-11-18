// Manejo centralizado de respuestas de error.
// Formato único para toda la API: { error, message, details }.
// El detalle técnico se registra solo en el servidor; al cliente nunca se le
// envían stacks ni mensajes internos de la base de datos.
import { z, ZodError } from 'zod';
import { UniqueConstraintError } from 'sequelize';
import multer from 'multer';
import { HttpError } from '../utils/HttpError.js';

const send = (res, status, error, message, details = null) =>
    res.status(status).json({ error, message, details });

export function notFound(req, res) {
    send(res, 404, 'ROUTE_NOT_FOUND', 'Ruta no encontrada');
}

// Express identifica este middleware por sus cuatro parámetros: no quitarlos.
export function errorHandler(err, req, res, next) {
    if (err instanceof HttpError) {
        return send(res, err.status, err.code, err.message, err.details);
    }
    if (err instanceof ZodError) {
        // flattenError agrupa los mensajes de Zod por campo: { formErrors, fieldErrors }.
        return send(res, 400, 'VALIDATION_ERROR', 'Datos inválidos', z.flattenError(err));
    }
    // Errores propios de Multer: traen un `code` que identifica el límite violado.
    // Multer ya borra los archivos parciales que alcanzó a escribir antes de fallar.
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return send(res, 413, 'FILE_TOO_LARGE', 'El archivo supera el tamaño máximo permitido (5 MiB)');
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return send(res, 400, 'TOO_MANY_FILES', 'Se superó la cantidad máxima de archivos por lote (5)');
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return send(res, 400, 'UNEXPECTED_FILE_FIELD', `Campo de archivo incorrecto: "${err.field}"`);
        }
        return send(res, 400, 'UPLOAD_ERROR', 'Error al procesar la subida');
    }
    // Violación de UNIQUE (document_number, case_number): conflicto con el estado actual.
    if (err instanceof UniqueConstraintError) {
        const fields = Object.keys(err.fields ?? {});
        return send(res, 409, 'DUPLICATE_VALUE', 'Ya existe un registro con ese valor', { fields });
    }
    // body-parser no debe exponer el detalle del parser al cliente.
    if (err.type === 'entity.parse.failed') {
        return send(res, 400, 'INVALID_JSON', 'JSON inválido');
    }

    console.error(err);
    send(res, 500, 'INTERNAL_ERROR', 'Error interno del servidor');
}
