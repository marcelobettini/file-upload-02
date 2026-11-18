import express from 'express';
import helmet from 'helmet';
import healthRouter from './routes/health.routes.js';
import { clientsRouter } from './routes/clients.routes.js';
import { casesRouter } from './routes/cases.routes.js';
import { documentsRouter } from './routes/documents.routes.js';
import { sequelize } from './config/database.js';
import './models/index.js'; // registra modelos y asociaciones antes de sync()
import { errorHandler, notFound } from './middlewares/errorHandler.js';
const port = process.env.PORT || 3000;

export const app = express();
app.use(helmet());

// Middlewares para parsear el cuerpo de las requests.
app.use(express.json()); // parsea JSON
app.use(express.urlencoded({ extended: true })); // parsea x-www-form-urlencoded

// Público: sirve para saber si el proceso está vivo, sin tocar la base.
app.use('/health', healthRouter);
// Rutas de la API. Se delega la implementación a los routers.
app.use('/api/clients', clientsRouter);
app.use('/api/cases', casesRouter);
app.use('/api', documentsRouter); // /api/cases/:id/documents (y en la etapa 4, /api/documents/:id)

// Orden importante: primero 404, luego el manejador de errores.
app.use(notFound);
app.use(errorHandler);

// sync() crea las tablas si no existen. Suficiente para un tutorial;
// en producción se usan migraciones.
await sequelize.sync();

app.listen(port, (error) => {
    if (error) {
        console.error(`Error al iniciar el servidor: ${error}`);
    } else {
        console.log(`Servidor escuchando en http://localhost:${port}`);
    }
});
