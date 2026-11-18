import express from 'express';
import helmet from 'helmet';
import healthRouter from './routes/health.routes.js';
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


// Orden importante: primero 404, luego el manejador de errores.
app.use(notFound);
app.use(errorHandler);

app.listen(port, (error) => {
    if (error) {
        console.error(`Error al iniciar el servidor: ${error}`);
    } else {
        console.log(`Servidor escuchando en http://localhost:${port}`);
    }
});
