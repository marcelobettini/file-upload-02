import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../schemas/common.schema.js';
import { createClientSchema, updateClientSchema } from '../schemas/client.schema.js';
import * as ctrl from '../controllers/clients.controller.js';

export const clientsRouter = Router();

clientsRouter.post('/', validate(createClientSchema), ctrl.createClient);
clientsRouter.get('/', ctrl.listClients);
clientsRouter.get('/:id', validate(idParamSchema, 'params'), ctrl.getClient);
clientsRouter.patch('/:id', validate(idParamSchema, 'params'), validate(updateClientSchema), ctrl.updateClient);
