import fs from 'node:fs/promises';
import path from 'node:path';
import { Case, Document } from '../models/index.js';
import { HttpError } from '../utils/HttpError.js';
import { UPLOADS_DIR } from '../config/upload.js';

// Middleware que corre ANTES de Multer: si el expediente no existe, ni siquiera
// se procesa el cuerpo de la petición (no se escribe ningún archivo).
export async function assertCaseExists(req, res, next) {
    const found = await Case.findByPk(req.valid.params.id);
    if (!found) throw new HttpError(404, 'CASE_NOT_FOUND', 'El expediente no existe');
    next();
}

// Se llega acá solo si Multer terminó bien: el archivo YA está escrito en disco.
export async function uploadDocument(req, res) {
    // Si el cliente no envió el campo `document`, Multer no falla: req.file queda undefined.
    if (!req.file) {
        throw new HttpError(400, 'FILE_REQUIRED', 'Debe enviar un archivo en el campo "document"');
    }

    try {
        const doc = await Document.create({
            case_id: req.valid.params.id,
            original_name: req.file.originalname,
            stored_name: req.file.filename,
            mime_type: req.file.mimetype,
            size: req.file.size,
        });
        res.status(201).json(doc);
    } catch (err) {
        // Compensación: MySQL falló pero el archivo ya existe. Lo borramos para no
        // dejar basura en disco. (MySQL y disco no comparten transacción.)
        await fs.unlink(path.join(UPLOADS_DIR, req.file.filename)).catch(() => {});
        throw err;
    }
}

export async function listDocuments(req, res) {
    // Solo metadatos: nunca devolvemos los bytes del archivo.
    res.json(await Document.findAll({ where: { case_id: req.valid.params.id }, order: [['id', 'ASC']] }));
}
