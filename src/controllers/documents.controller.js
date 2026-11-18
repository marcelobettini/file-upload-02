import fs from 'node:fs/promises';
import path from 'node:path';
import { Case, Document } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/HttpError.js';
import { UPLOADS_DIR, MAX_BATCH_SIZE } from '../config/upload.js';

// Middleware que corre ANTES de Multer: si el expediente no existe, ni siquiera
// se procesa el cuerpo de la petición (no se escribe ningún archivo).
export async function assertCaseExists(req, res, next) {
    const found = await Case.findByPk(req.params.id);
    if (!found) throw new HttpError(404, 'CASE_NOT_FOUND', 'El expediente no existe');
    next();
}

// Acción compensatoria: borra del disco los archivos que Multer ya escribió.
// Usa allSettled para intentar con TODOS aunque alguno falle, y nunca lanza:
// quien lo llama ya está manejando otro error y no debe perderlo.
async function removeFiles(files) {
    await Promise.allSettled(files.map((f) => fs.unlink(path.join(UPLOADS_DIR, f.filename))));
}

// Convierte un archivo de Multer en los campos de la tabla `documents`.
const toRecord = (caseId, file) => ({
    case_id: caseId,
    original_name: file.originalname,
    stored_name: file.filename,
    mime_type: file.mimetype,
    size: file.size,
});

// Se llega acá solo si Multer terminó bien: el archivo YA está escrito en disco.
export async function uploadDocument(req, res) {
    // Si el cliente no envió el campo `document`, Multer no falla: req.file queda undefined.
    if (!req.file) {
        throw new HttpError(400, 'FILE_REQUIRED', 'Debe enviar un archivo en el campo "document"');
    }

    try {
        const doc = await Document.create(toRecord(req.params.id, req.file));
        res.status(201).json(doc);
    } catch (err) {
        // MySQL falló pero el archivo ya existe: lo borramos para no dejar basura.
        // (MySQL y disco no comparten transacción.)
        await removeFiles([req.file]);
        throw err;
    }
}

// Subida múltiple: TODO O NADA. Los archivos ya están en disco (req.files es un array).
export async function uploadDocumentsBatch(req, res) {
    const files = req.files ?? [];

    if (files.length === 0) {
        throw new HttpError(400, 'FILE_REQUIRED', 'Debe enviar de 1 a 5 archivos en el campo "documents"');
    }

    try {
        // Multer limita cada archivo, pero no la suma. La comprobamos acá.
        const total = files.reduce((sum, f) => sum + f.size, 0);
        if (total > MAX_BATCH_SIZE) {
            throw new HttpError(413, 'BATCH_TOO_LARGE', 'El lote supera el tamaño total máximo permitido (20 MiB)');
        }

        // Una transacción agrupa los INSERT: o se guardan todos o ninguno.
        // Si el callback lanza un error, Sequelize hace ROLLBACK automáticamente.
        const docs = await sequelize.transaction((transaction) =>
            Document.bulkCreate(files.map((f) => toRecord(req.params.id, f)), { transaction }),
        );

        res.status(201).json(docs);
    } catch (err) {
        // La transacción deshizo los registros; falta deshacer los archivos.
        await removeFiles(files);
        throw err;
    }
}

export async function listDocuments(req, res) {
    // Solo metadatos: nunca devolvemos los bytes del archivo.
    res.json(await Document.findAll({ where: { case_id: req.params.id }, order: [['id', 'ASC']] }));
}

async function findDocumentOr404(id) {
    const doc = await Document.findByPk(id);
    if (!doc) throw new HttpError(404, 'DOCUMENT_NOT_FOUND', 'El documento no existe');
    return doc;
}

// Descarga: MySQL es la única fuente de verdad. El cliente pide un ID, nunca un
// nombre de archivo, y jamás se le revela la ruta física de uploads/.
export async function downloadDocument(req, res, next) {
    const doc = await findDocumentOr404(req.params.id);

    // res.download(archivo, nombreParaElCliente, opciones, callback)
    //  - `root` fija la carpeta base: `stored_name` se resuelve siempre dentro de uploads/.
    //  - el 2.º argumento es el nombre con que el navegador guardará el archivo (el original).
    //  - el callback se ejecuta si algo falla; si ya se empezó a enviar, no se puede cambiar la respuesta.
    res.download(doc.stored_name, doc.original_name, { root: UPLOADS_DIR }, (err) => {
        if (!err || res.headersSent) return;
        // Hay registro pero no archivo (alguien lo borró a mano): no enviamos datos inexistentes.
        if (err.code === 'ENOENT') {
            return next(new HttpError(404, 'FILE_NOT_FOUND', 'El archivo físico no está disponible'));
        }
        next(err);
    });
}

// Eliminación: primero el archivo, después el registro. El orden es deliberado.
export async function deleteDocument(req, res) {
    const doc = await findDocumentOr404(req.params.id);

    // Si unlink falla, el error se propaga y el registro NO se toca: sigue apuntando
    // a un archivo que existe y el usuario puede reintentar.
    await fs.unlink(path.join(UPLOADS_DIR, doc.stored_name));

    // Limitación pedagógica: si MySQL falla justo acá, queda un registro huérfano
    // (apunta a un archivo que ya no existe). No añadimos infraestructura para evitarlo.
    await doc.destroy();

    res.status(204).end(); // 204 No Content: sin cuerpo
}
