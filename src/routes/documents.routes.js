import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../schemas/common.schema.js';
import { upload } from '../config/upload.js';
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

documentsRouter.get('/cases/:id/documents', validate(idParamSchema, 'params'), ctrl.assertCaseExists, ctrl.listDocuments);
