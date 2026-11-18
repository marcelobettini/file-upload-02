import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../schemas/common.schema.js';
import { upload, uploadBatch, MAX_BATCH_FILES } from '../config/upload.js';
import * as ctrl from '../controllers/documents.controller.js';

export const documentsRouter = Router();

// Orden de la cadena (importa):
//   1) validate -> 2) assertCaseExists -> 3) Multer -> 4) controlador
// `single('document')` espera UN archivo en el campo "document" y lo deja en req.file.
documentsRouter.post(
    '/cases/:id/documents',
    validate(idParamSchema, 'params'),
    ctrl.assertCaseExists,
    upload.single('document'),
    ctrl.uploadDocument,
);

// Lote: `array('documents', 5)` acepta de 0 a 5 archivos repetidos bajo el MISMO nombre
// de campo ("documents") y los deja en req.files (un array). El mínimo de 1 se verifica
// en el controlador, porque Multer no falla cuando no llega ningún archivo.
documentsRouter.post(
    '/cases/:id/documents/batch',
    validate(idParamSchema, 'params'),
    ctrl.assertCaseExists,
    uploadBatch.array('documents', MAX_BATCH_FILES),
    ctrl.uploadDocumentsBatch,
);

documentsRouter.get('/cases/:id/documents', validate(idParamSchema, 'params'), ctrl.assertCaseExists, ctrl.listDocuments);

// Estas dos rutas operan sobre un documento por su propio ID (no por expediente).
documentsRouter.get('/documents/:id/download', validate(idParamSchema, 'params'), ctrl.downloadDocument);
documentsRouter.delete('/documents/:id', validate(idParamSchema, 'params'), ctrl.deleteDocument);
