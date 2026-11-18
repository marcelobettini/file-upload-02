import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../schemas/common.schema.js';
import { createCaseSchema, updateCaseSchema } from '../schemas/case.schema.js';
import * as ctrl from '../controllers/cases.controller.js';

export const casesRouter = Router();

casesRouter.post('/', validate(createCaseSchema), ctrl.createCase);
casesRouter.get('/', ctrl.listCases);
casesRouter.get('/:id', validate(idParamSchema, 'params'), ctrl.getCase);
casesRouter.patch('/:id', validate(idParamSchema, 'params'), validate(updateCaseSchema), ctrl.updateCase);
