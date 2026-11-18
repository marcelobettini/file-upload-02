// Configuración de Multer. Es el corazón del tutorial: leela con calma.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { HttpError } from '../utils/HttpError.js';

// Carpeta ÚNICA donde se guardan los archivos. NO se publica con express.static():
// la única forma de descargar será un endpoint que consulte MySQL (etapa 4).
export const UPLOADS_DIR = path.resolve('uploads');

// Multer no crea la carpeta cuando `destination` es una función, así que la
// creamos nosotros al cargar el módulo. `recursive` evita error si ya existe.
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Fuente de verdad de los tipos permitidos: MIME declarado -> extensión física.
// La extensión sale de ACÁ, nunca del nombre que mandó el cliente.
export const ALLOWED_TYPES = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MiB

// diskStorage decide DÓNDE y con QUÉ NOMBRE se escribe cada archivo.
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    // El nombre lo genera el servidor: así dos archivos con el mismo nombre original
    // no se pisan y un nombre malicioso (../../x) nunca llega al sistema de archivos.
    filename: (req, file, cb) => cb(null, `${randomUUID()}${ALLOWED_TYPES[file.mimetype]}`),
});

// fileFilter corre ANTES de escribir en disco. cb(null, true) acepta; un error rechaza.
// ADVERTENCIA: file.mimetype lo declara el cliente y puede falsificarse. Para este
// ejercicio local alcanza; una app real debería inspeccionar el contenido del archivo.
function fileFilter(req, file, cb) {
    if (Object.hasOwn(ALLOWED_TYPES, file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'INVALID_FILE_TYPE', 'Tipo de archivo no permitido. Se aceptan PDF, JPG y PNG'));
}

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE },
});
