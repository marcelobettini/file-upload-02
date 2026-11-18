import { Case, Client } from '../models/index.js';
import { HttpError } from '../utils/HttpError.js';

async function assertClientExists(clientId) {
    if (!(await Client.findByPk(clientId))) {
        throw new HttpError(404, 'CLIENT_NOT_FOUND', 'El cliente referenciado no existe');
    }
}

async function findCaseOr404(id) {
    const found = await Case.findByPk(id);
    if (!found) throw new HttpError(404, 'CASE_NOT_FOUND', 'El expediente no existe');
    return found;
}

export async function createCase(req, res) {
    await assertClientExists(req.valid.body.client_id);
    const created = await Case.create(req.valid.body);
    res.status(201).json(created);
}

export async function listCases(req, res) {
    res.json(await Case.findAll());
}

export async function getCase(req, res) {
    res.json(await findCaseOr404(req.valid.params.id));
}

export async function updateCase(req, res) {
    const found = await findCaseOr404(req.valid.params.id);
    if (req.valid.body.client_id !== undefined) {
        await assertClientExists(req.valid.body.client_id);
    }
    await found.update(req.valid.body);
    res.json(found);
}
