# Tutorial: Subida de archivos con Express y Multer

## Sistema educativo de expedientes judiciales

Una API REST en Node.js para aprender a **subir, descargar y eliminar archivos** con Multer. El negocio (un estudio jurídico ficticio) se mantiene deliberadamente simple para que el foco esté en `multipart/form-data`, `diskStorage`, límites, manejo de errores y consistencia entre MySQL y disco.

> ⚠️ Es un ejercicio educativo. No uses documentación judicial real.

La especificación completa está en [`project-spec.md`](project-spec.md). Este README se construye **de forma incremental**: cada etapa tiene su propio commit y una etiqueta de git para que puedas retomar desde cualquier punto.

| Etapa | Contenido | Etiqueta |
| --- | --- | --- |
| 1 | Modelo y CRUD de clientes y expedientes | `etapa-1` |
| 2 | Subida individual (`upload.single`) | `etapa-2` |
| 3 | Subida múltiple (`upload.array`), filtros y límites | `etapa-3` |
| 4 | Consistencia, transacciones, descarga y borrado | `etapa-4` |

Para ver el código tal como quedó al final de una etapa: `git checkout etapa-1`. Para volver: `git checkout main`.

---

## Puesta en marcha

Requisitos: Node.js 22 o superior (usamos `--env-file`) y un servidor MySQL.

```bash
npm install
cp .env-example .env     # completá tus credenciales
npm run dev
```

Variables de `.env`: `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `PORT`. La base de datos debe existir; las tablas se crean solas al arrancar.

Comprobá que todo funciona: `GET http://localhost:<PORT>/health` debe responder `{ "status": "ok", "db": "ok", ... }`.

---

## Etapa 1: Modelo y CRUD

Todavía no subimos archivos. Primero construimos la base sobre la que se van a colgar los documentos: clientes y expedientes (`clients 1:N cases`).

### 1.1 Estructura del proyecto

```text
src/
  config/database.js        conexión Sequelize
  config/upload.js          configuración de Multer (etapa 2)
  models/                   Client, Case y sus asociaciones
  schemas/                  validación con Zod
  controllers/              lógica de cada endpoint
  routes/                   rutas de Express
  middlewares/              validate y errorHandler
  utils/HttpError.js        error con código HTTP
  index.js                  arranque de la app
```

Separar en capas hace que, cuando agreguemos Multer, el middleware de subida sea una pieza más en la cadena de la ruta y no se mezcle con el resto.

### 1.2 Modelos con Sequelize

```js
// src/models/Case.js (resumen)
export const Case = sequelize.define('Case', {
    case_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    status: { type: DataTypes.ENUM('OPEN', 'CLOSED'), allowNull: false, defaultValue: 'OPEN' },
    client_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    // ...
}, { tableName: 'cases', timestamps: false });
```

Decisiones a notar:

- **Atributos en `snake_case`**, iguales a las columnas. Así el JSON de la API coincide con la tabla y con la spec, sin traducciones.
- **`timestamps: false`**: Sequelize agregaría `createdAt` y `updatedAt`. En `cases` declaramos `created_at` a mano para tener exactamente las columnas de la spec.
- **`document_number` es `STRING`**, no número: un DNI/CUIT no se suma ni se resta y podría tener ceros a la izquierda.

Las asociaciones viven en `src/models/index.js`:

```js
Client.hasMany(Case, { foreignKey: { name: 'client_id', allowNull: false }, onDelete: 'RESTRICT' });
Case.belongsTo(Client, { foreignKey: { name: 'client_id', allowNull: false } });
```

Usamos `RESTRICT` y no `CASCADE`: no existen endpoints para borrar clientes ni expedientes, y más adelante no queremos que un borrado en cascada deje archivos huérfanos en disco.

Las tablas se crean con `await sequelize.sync()` al arrancar. Es cómodo para aprender; un proyecto real usaría migraciones.

### 1.3 Validación con Zod

Nunca confiamos en lo que llega en `req.body`. Cada endpoint declara un esquema:

```js
export const createClientSchema = z.strictObject({
    first_name: z.string().trim().min(1).max(100),
    // ...
    email: z.email().max(150).nullish(),
});

export const updateClientSchema = createClientSchema.partial()
    .refine((d) => Object.keys(d).length > 0, { message: 'Debe informarse al menos un campo' });
```

- `z.strictObject` rechaza campos desconocidos: así no se puede intentar editar `id` por `PATCH`.
- `.partial()` vuelve todo opcional para `PATCH` (reutilizamos el esquema de creación), y `.refine()` exige al menos un campo.
- Los parámetros de ruta (`:id`) llegan como texto; `z.coerce.number()` los convierte y rechaza `abc`.

Para aplicar un esquema a una ruta usamos un middleware muy corto, `validate(schema, 'body' | 'params')`:

```js
export const validate = (schema, source = 'body') => (req, res, next) => {
    req[source] = schema.parse(req[source]);
    next();
};
```

Hace dos cosas:

1. **Si los datos son válidos, reemplaza `req.body` (o `req.params`) por el resultado de Zod**: sin campos de más, con los textos recortados y con los tipos convertidos. Por eso, en el controlador, `req.params.id` ya es un **número** aunque Express lo entregue como texto. No se inventa ninguna propiedad nueva: los controladores leen `req.body` y `req.params` como siempre.
2. **Si no son válidos, `schema.parse()` lanza un `ZodError`.** Express lo captura y lo manda al manejador central de errores, que responde `400`. No hace falta `try/catch`.

> `req.body` y `req.params` son propiedades normales de Express y se pueden reasignar. No ocurre lo mismo con `req.query`, que en Express 5 es de solo lectura; no lo usamos en este proyecto.

### 1.4 Errores con un formato único

Toda respuesta de error de la API tiene la forma de la spec:

```json
{ "error": "VALIDATION_ERROR", "message": "Datos inválidos",
  "details": { "formErrors": [], "fieldErrors": { "first_name": ["Too small: expected string to have >=1 characters"] } } }
```

En los errores de validación, `details` sale directo de `z.flattenError(err)`: los mensajes de Zod agrupados por campo. Quedan en inglés a propósito: traducirlos o personalizarlos es una mejora posible, pero no es el tema de este tutorial.

Los controladores lanzan `new HttpError(404, 'CLIENT_NOT_FOUND', '...')` y `errorHandler` lo traduce. Allí también se convierten:

| Origen | Respuesta |
| --- | --- |
| `ZodError` | `400 VALIDATION_ERROR` |
| `UniqueConstraintError` de Sequelize | `409 DUPLICATE_VALUE` |
| JSON mal formado | `400 INVALID_JSON` |
| Cualquier otra cosa | `500 INTERNAL_ERROR`, sin exponer detalles internos |

> **Express 5** captura los errores de los controladores `async` automáticamente. Por eso no hay `try/catch` en ellos: alcanza con `throw`.

### 1.5 Endpoints

| Método | Ruta | Éxito |
| --- | --- | --- |
| `POST` | `/api/clients` | `201` |
| `GET` | `/api/clients` · `/api/clients/:id` | `200` |
| `PATCH` | `/api/clients/:id` | `200` |
| `POST` | `/api/cases` | `201` |
| `GET` | `/api/cases` · `/api/cases/:id` | `200` |
| `PATCH` | `/api/cases/:id` | `200` |

Al crear o editar un expediente se verifica que el cliente exista (`404` si no). Un `case_number` o `document_number` repetido devuelve `409`. El estado puede alternar entre `OPEN` y `CLOSED` libremente.

### 1.6 Probalo

```bash
# Crear un cliente
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Ana","last_name":"Paz","document_number":"20123456"}'

# Crear un expediente para el cliente 1
curl -X POST http://localhost:3000/api/cases \
  -H "Content-Type: application/json" \
  -d '{"case_number":"EXP-001","title":"Paz c/ Gómez","client_id":1}'

# Cerrarlo
curl -X PATCH http://localhost:3000/api/cases/1 \
  -H "Content-Type: application/json" -d '{"status":"CLOSED"}'
```

Repetí el primer comando y vas a ver el `409`. Enviá `{}` en un `PATCH` y vas a ver el `400`.

### Ejercicios sugeridos

1. Intentá editar el `id` de un cliente por `PATCH`. ¿Qué respuesta obtenés y por qué?
2. Creá un expediente con `client_id: 999`. ¿Dónde se decide el `404`?
3. Cambiá `onDelete: 'RESTRICT'` por `'CASCADE'` y pensá qué pasaría con los archivos de un expediente si existiera un `DELETE`.

---

## Etapa 2: Subida individual

Ahora sí: adjuntamos **un** documento a un expediente con `POST /api/cases/:id/documents`.

### 2.1 ¿Qué es `multipart/form-data`?

Hasta ahora el cuerpo de las peticiones era JSON, y `express.json()` lo parsea. Un archivo es binario y no entra en JSON, así que el cliente usa `multipart/form-data`: el cuerpo se divide en "partes", cada una con su nombre de campo, y una de ellas puede ser un archivo.

**Express no sabe leer ese formato.** Para eso está Multer: lee el cuerpo, escribe el archivo y deja el resultado en `req.file`.

```text
POST /api/cases/1/documents
Content-Type: multipart/form-data; boundary=----X

------X
Content-Disposition: form-data; name="document"; filename="escrito.pdf"
Content-Type: application/pdf

<bytes del archivo>
------X--
```

El nombre del campo (`document`) tiene que coincidir con el que declaramos en `upload.single('document')`.

### 2.2 Dónde viven los datos

| Qué | Dónde |
| --- | --- |
| Los bytes del archivo | Disco: `uploads/<uuid>.<ext>` |
| Nombre original, MIME, tamaño, expediente | MySQL: tabla `documents` |
| El vínculo entre ambos | La columna `stored_name` |

Por eso creamos el modelo `Document` (`src/models/Document.js`) y la asociación `Case 1:N Document`. Igual que antes, sin `CASCADE`: borrar filas sin borrar archivos dejaría basura en disco.

### 2.3 Configurar Multer (`src/config/upload.js`)

**`diskStorage`**: decide dónde y con qué nombre se guarda cada archivo.

```js
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `${randomUUID()}${ALLOWED_TYPES[file.mimetype]}`),
});
```

- El nombre **lo genera el servidor** con `crypto.randomUUID()`. Así dos archivos con el mismo nombre original no se pisan, y un nombre como `../../etc/x` nunca toca el sistema de archivos.
- La **extensión sale del MIME admitido**, no del nombre recibido. Un archivo llamado `foto.pdf` declarado como `image/png` se guarda como `.png`.
- Multer no crea `uploads/` si `destination` es una función; lo hacemos con `fs.mkdirSync(..., { recursive: true })` al cargar el módulo.

**`fileFilter`**: se ejecuta *antes* de escribir en disco.

```js
function fileFilter(req, file, cb) {
    if (Object.hasOwn(ALLOWED_TYPES, file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'INVALID_FILE_TYPE', '...'));
}
```

**`limits.fileSize`**: `5 * 1024 * 1024` bytes (5 MiB). Si se excede, Multer corta la lectura y lanza un `MulterError` con código `LIMIT_FILE_SIZE`.

**`defParamCharset: 'utf8'`**: Multer decodifica por defecto el nombre del archivo como `latin1`, pero navegadores, Postman y Bruno lo envían en UTF-8. Sin esta opción, un archivo llamado `Escrito número 1.pdf` se guardaría en `original_name` como `Escrito nÃºmero 1.pdf` y la descarga saldría con ese nombre roto. Es un error clásico que solo aparece con caracteres no ASCII (tildes, ñ), así que probá siempre con uno.

> ⚠️ **`file.mimetype` lo declara el cliente y se puede falsificar.** Alcanza para este ejercicio local con archivos ficticios. Una aplicación real debe inspeccionar el contenido (*magic bytes*) y aplicar medidas de seguridad adicionales.

Y `uploads/` **no se publica** con `express.static()`: nadie puede pedir un archivo escribiendo su URL. En la etapa 4 la descarga pasará por un endpoint que consulta MySQL. La carpeta está en `.gitignore`.

### 2.4 La cadena de middlewares

```js
documentsRouter.post(
    '/cases/:id/documents',
    validate(idParamSchema, 'params'),   // 1) el id es un número válido
    ctrl.assertCaseExists,               // 2) el expediente existe
    upload.single('document'),           // 3) Multer escribe el archivo
    ctrl.uploadDocument,                 // 4) guardamos los metadatos
);
```

El orden importa: verificamos el expediente **antes** de Multer. Si no existe, devolvemos `404` sin haber escrito ni un byte. Si lo pusiéramos después, tendríamos que borrar el archivo.

### 2.5 El controlador

```js
if (!req.file) throw new HttpError(400, 'FILE_REQUIRED', '...');

try {
    const doc = await Document.create({ case_id, original_name: req.file.originalname,
        stored_name: req.file.filename, mime_type: req.file.mimetype, size: req.file.size });
    res.status(201).json(doc);
} catch (err) {
    await fs.unlink(path.join(UPLOADS_DIR, req.file.filename)).catch(() => {});
    throw err;
}
```

- Si el cliente no manda el campo, Multer **no falla**: `req.file` queda `undefined`. Hay que comprobarlo.
- Cuando llegamos al `try`, el archivo **ya está en disco**. Si MySQL falla, lo borramos: es una **acción compensatoria**. MySQL y disco no comparten transacción, así que no hay un "rollback" automático.
- Cuando falla el propio Multer (tipo inválido, tamaño), él mismo elimina lo que alcanzó a escribir.

### 2.6 Errores de Multer

`errorHandler` traduce los `MulterError` a respuestas comprensibles:

| Situación | Respuesta |
| --- | --- |
| MIME no permitido | `400 INVALID_FILE_TYPE` |
| Archivo > 5 MiB (`LIMIT_FILE_SIZE`) | `413 FILE_TOO_LARGE` |
| Campo con otro nombre (`LIMIT_UNEXPECTED_FILE`) | `400 UNEXPECTED_FILE_FIELD` |
| No se envió archivo | `400 FILE_REQUIRED` |
| Expediente inexistente | `404 CASE_NOT_FOUND` |

También agregamos `GET /api/cases/:id/documents`, que lista solo metadatos, para poder comprobar los resultados.

### 2.7 Probalo

Con Postman o Bruno: método `POST`, cuerpo `form-data`, una clave `document` de tipo **File**. Con curl:

```bash
curl -F "document=@escrito.pdf;type=application/pdf" http://localhost:3000/api/cases/1/documents
curl http://localhost:3000/api/cases/1/documents
ls uploads/
```

### Ejercicios sugeridos

1. Subí dos veces el mismo archivo. ¿Cuántos registros y cuántos archivos hay? ¿Qué nombres tienen?
2. Subí un `.txt`. Después mirá `uploads/`: ¿quedó algo?
3. Enviá el archivo en un campo llamado `file`. ¿Qué código de error de Multer aparece?
4. Subí un `.png` con nombre `foto.pdf` y mirá la extensión guardada.
5. Mové `assertCaseExists` después de `upload.single(...)` y subí a un expediente inexistente. ¿Qué queda en `uploads/`?

---

## Etapa 3: Subida múltiple

Adjuntamos de **1 a 5 documentos** en una sola petición con `POST /api/cases/:id/documents/batch`. La regla es **todo o nada**: si algo falla, no debe quedar ningún registro ni ningún archivo de ese intento.

### 3.1 `single` vs `array`

| | `upload.single('document')` | `upload.array('documents', 5)` |
| --- | --- | --- |
| Archivos | 1 | de 0 a 5 |
| Campo | `document` | `documents` (se **repite** una vez por archivo) |
| Resultado | `req.file` (un objeto) | `req.files` (un **array**) |

En el cliente se repite el mismo nombre de campo:

```bash
curl -F "documents=@a.pdf;type=application/pdf" \
     -F "documents=@b.png;type=image/png" \
     http://localhost:3000/api/cases/1/documents/batch
```

En Postman o Bruno: varias filas `documents` de tipo **File**.

### 3.2 Los límites son tres, y cada uno vive en un lugar distinto

| Regla | Quién la aplica | Respuesta |
| --- | --- | --- |
| Máx. **5 MiB** por archivo | Multer: `limits.fileSize` | `413 FILE_TOO_LARGE` |
| Máx. **5 archivos** por lote | Multer: `limits.files` | `400 TOO_MANY_FILES` |
| Máx. **20 MiB** en total | **Nosotros**, en el controlador | `413 BATCH_TOO_LARGE` |
| Al menos **1** archivo | **Nosotros**, en el controlador | `400 FILE_REQUIRED` |

Multer no tiene una opción para "tamaño total": cada archivo se mide por separado. Con 5 archivos de 4,5 MiB ninguno excede su límite, pero juntos suman 22,5 MiB. Esa suma se comprueba **después** de Multer, sobre `req.files`:

```js
const total = files.reduce((sum, f) => sum + f.size, 0);
if (total > MAX_BATCH_SIZE) throw new HttpError(413, 'BATCH_TOO_LARGE', '...');
```

Consecuencia importante: cuando se detecta el exceso, **los archivos ya están escritos en disco** y hay que borrarlos.

Para el lote usamos otra instancia de Multer (`uploadBatch`) con `limits.files: 5`. Así la subida individual conserva su configuración sin cambios. Los valores `5`, `5 MiB` y `20 MiB` viven como constantes exportadas en `src/config/upload.js`.

### 3.3 Todo o nada: transacción + compensación

MySQL y el disco son dos sistemas distintos y **no comparten una transacción**. El "todo o nada" se logra con dos herramientas combinadas:

```js
try {
    // 1) Validación del total (puede lanzar)
    // 2) Transacción: o entran todos los registros o ninguno
    const docs = await sequelize.transaction((transaction) =>
        Document.bulkCreate(files.map(toRecord), { transaction }),
    );
    res.status(201).json(docs);
} catch (err) {
    await removeFiles(files);   // 3) compensación: borrar los archivos del intento
    throw err;
}
```

- **Transacción** (`sequelize.transaction(callback)`): si el callback lanza un error, Sequelize hace `ROLLBACK` solo y los registros desaparecen.
- **Compensación** (`removeFiles`): deshace lo que la base no puede deshacer, que son los archivos. Usa `Promise.allSettled` para intentar borrar **todos** aunque alguno falle, y nunca lanza, para no tapar el error original.

¿Y cuando falla **Multer** (tipo inválido en el tercer archivo, por ejemplo)? Él mismo elimina los archivos que ya había escrito antes de abortar, y luego pasa el error al manejador. Por eso en ese caso el controlador ni siquiera se ejecuta.

> **Matiz:** esto es "todo o nada" *en condiciones normales*. Si el proceso o el sistema operativo se cae justo entre la escritura y el borrado, pueden quedar archivos sueltos. No hay atomicidad absoluta entre dos sistemas independientes.

### 3.4 Dos códigos de error parecidos

Multer 2.x tiene dos mecanismos que limitan cantidad:

- `limits.files` → error `LIMIT_FILE_COUNT`.
- el `maxCount` de `array('documents', 5)` → error `LIMIT_UNEXPECTED_FILE`.

Con ambos en 5, el que se dispara primero es `LIMIT_FILE_COUNT`, y `errorHandler` lo traduce a `400 TOO_MANY_FILES`. `LIMIT_UNEXPECTED_FILE` queda para cuando el campo tiene otro nombre (`400 UNEXPECTED_FILE_FIELD`).

### 3.5 Probalo

| Prueba | Resultado esperado |
| --- | --- |
| 3 archivos válidos | `201` y un array con 3 documentos |
| 6 archivos | `400 TOO_MANY_FILES` |
| 5 archivos de 4,5 MiB | `413 BATCH_TOO_LARGE` |
| 2 PDF + 1 `.txt` | `400 INVALID_FILE_TYPE`, nada guardado |
| 2 PDF + 1 archivo de 6 MiB | `413 FILE_TOO_LARGE`, nada guardado |
| Sin archivos | `400 FILE_REQUIRED` |
| Campo `files` en vez de `documents` | `400 UNEXPECTED_FILE_FIELD` |

Después de cada intento fallido, ejecutá `ls uploads/` y `GET /api/cases/1/documents`: las cantidades no deben haber cambiado.

### Ejercicios sugeridos

1. Provocá un **fallo real de MySQL** y verificá la compensación. `original_name` es `VARCHAR(255)`: subí un lote donde el segundo archivo tenga un nombre de 300 caracteres (con curl: `-F "documents=@a.pdf;filename=<300 letras>.pdf"`). Vas a ver un `500`, y ni registros ni archivos nuevos.
2. Quitá el `removeFiles(files)` del `catch` y repetí el ejercicio 1. ¿Qué queda en `uploads/`? Así se ve para qué sirve la compensación.
3. `bulkCreate` genera **un solo** `INSERT` con varias filas, que MySQL ya ejecuta de forma atómica. La transacción se vuelve imprescindible cuando se insertan los registros uno por uno. Reemplazá el `bulkCreate` por `for (const f of files) await Document.create(toRecord(id, f))` **sin** transacción y repetí el ejercicio 1: ¿qué pasa con la primera fila cuando falla la segunda? Después envolvé el bucle en `sequelize.transaction` (pasando `{ transaction }` a cada `create`) y comparalo.
4. Este error `500` por un nombre demasiado largo es una falta de validación: ¿dónde agregarías el control para devolver un `400`?

---

## Etapa 4: Descarga y eliminación

Cerramos el ciclo de vida de un documento. Las transacciones y la compensación de archivos ya las vimos en la etapa 3; ahora faltan los dos endpoints que consumen lo guardado.

### 4.1 Descarga: `GET /api/documents/:id/download`

```js
res.download(doc.stored_name, doc.original_name, { root: UPLOADS_DIR }, (err) => { ... });
```

Tres ideas clave:

1. **El cliente pide un ID, nunca un nombre de archivo.** MySQL traduce el ID al nombre físico (`stored_name`). La ruta real de `uploads/` no se expone en ninguna respuesta, y por eso no hace falta (ni conviene) `express.static()`.
2. **`res.download(ruta, nombre)`** envía el archivo con la cabecera `Content-Disposition: attachment`. El segundo argumento es el nombre que verá el usuario al guardarlo: el **original**. Los nombres con tildes o espacios viajan correctamente codificados (`filename*=UTF-8''...`).
3. **`root: UPLOADS_DIR`** fija la carpeta base. Aunque un `stored_name` fuera manipulado, se resolvería siempre dentro de `uploads/`.

**¿Y si el registro existe pero el archivo no?** (alguien lo borró a mano). `res.download` no lanza una excepción que Express pueda capturar: avisa por su **callback**. Si el error es `ENOENT`, respondemos `404 FILE_NOT_FOUND`. Comprobamos `res.headersSent` primero: si ya empezó el envío, la respuesta no puede cambiarse.

### 4.2 Eliminación: `DELETE /api/documents/:id`

```js
await fs.unlink(path.join(UPLOADS_DIR, doc.stored_name));  // 1) archivo
await doc.destroy();                                       // 2) registro
res.status(204).end();                                     // 3) sin cuerpo
```

**El orden es deliberado.** Pensá qué pasa en cada caso de falla:

| Falla | Qué queda | Consecuencia |
| --- | --- | --- |
| `unlink` falla | Archivo **y** registro intactos | Consistente: se puede reintentar |
| `destroy` falla (tras `unlink` OK) | Registro sin archivo (**huérfano**) | Inconsistente |

Si invirtiéramos el orden (registro primero, archivo después), una falla del `unlink` dejaría un **archivo huérfano**, y además invisible: ya no habría ningún registro que lo apunte, y nadie sabría que existe. Es preferible un registro huérfano, que al menos se ve en la base.

> **Limitación reconocida:** el caso de la segunda fila (MySQL falla justo después del `unlink`) no se resuelve en este tutorial. Hacerlo exigiría infraestructura adicional (por ejemplo, una cola de limpieza). Es un buen ejemplo de por qué MySQL y disco, al no compartir transacción, siempre dejan alguna ventana de inconsistencia.

Se responde `204 No Content`: la operación salió bien y no hay nada que devolver.

### 4.3 Resumen de errores de la etapa

| Situación | Respuesta |
| --- | --- |
| ID inválido (`abc`) | `400 VALIDATION_ERROR` |
| Documento inexistente (descarga o borrado) | `404 DOCUMENT_NOT_FOUND` |
| Registro existe, archivo físico no | `404 FILE_NOT_FOUND` (descarga) |
| `unlink` falla | `500 INTERNAL_ERROR`, registro conservado |

### 4.4 Probalo

```bash
curl -OJ http://localhost:3000/api/documents/1/download   # -OJ usa el nombre que envía el servidor
curl -X DELETE -i http://localhost:3000/api/documents/1   # 204 y sin cuerpo
ls uploads/                                               # el archivo ya no está
curl -i -X DELETE http://localhost:3000/api/documents/1   # 404: ya no existe
```

### Ejercicios sugeridos

1. Subí un documento y borrá **a mano** su archivo de `uploads/`. Pedí la descarga: ¿qué respuesta recibís? ¿Y si intentás `DELETE`? ¿Es razonable ese resultado? ¿Qué cambiarías para poder eliminar un registro cuyo archivo ya no existe?
2. Forzá un fallo de `unlink`: reemplazá un archivo de `uploads/` por una **carpeta** con el mismo nombre y llamá a `DELETE`. Comprobá que el registro sigue en la base.
3. Intentá abrir `http://localhost:3000/uploads/<stored_name>` en el navegador. ¿Por qué da `404`?
4. Subí un documento a un expediente `CLOSED`. ¿Lo permite? Revisá la regla de negocio 5 de la especificación.

---

## Cierre: criterios de aceptación

Todos los puntos de la sección 9 de [`project-spec.md`](project-spec.md) tienen su correlato en este código. Un repaso de dónde se cumple cada grupo:

| Criterio | Dónde |
| --- | --- |
| CRUD de clientes y expedientes, duplicados `409`, cliente inexistente `404` | Etapa 1 |
| Subida individual, nombres únicos sin sobrescritura, MIME y 5 MiB | Etapa 2 |
| Lote de hasta 5, rechazo por cantidad y por 20 MiB, todo o nada | Etapa 3 |
| Listado, descarga con nombre original, borrado de archivo y registro | Etapas 2 y 4 |
| `uploads/` no expuesto, errores de Multer comprensibles | Etapas 2, 3 y 4 |

### Límites conscientes (leé esto antes de reutilizar el código)

- `file.mimetype` lo declara el cliente. Una aplicación real verificaría el contenido (*magic bytes*) y analizaría malware.
- No hay autenticación ni autorización: cualquiera con acceso a la API ve y borra todo.
- MySQL y disco no comparten transacción: el "todo o nada" es por compensación y no cubre una caída abrupta del proceso.
- `sequelize.sync()` en lugar de migraciones, y sin paginación en los listados.
- Un nombre de archivo de más de 255 caracteres produce un `500` en vez de un `400` (ver ejercicio de la etapa 3).
