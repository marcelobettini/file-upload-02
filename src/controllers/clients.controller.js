import { Client } from '../models/index.js';
import { HttpError } from '../utils/HttpError.js';

// Express 5 captura automáticamente los errores de funciones async:
// no hace falta try/catch ni next(err) en cada controlador.
export async function createClient(req, res) {
    const client = await Client.create(req.body);
    res.status(201).json(client);
}

export async function listClients(req, res) {
    res.json(await Client.findAll());
}

async function findClientOr404(id) {
    const client = await Client.findByPk(id);
    if (!client) throw new HttpError(404, 'CLIENT_NOT_FOUND', 'El cliente no existe');
    return client;
}

export async function getClient(req, res) {
    res.json(await findClientOr404(req.params.id));
}

export async function updateClient(req, res) {
    const client = await findClientOr404(req.params.id);
    await client.update(req.body);
    res.json(client);
}
