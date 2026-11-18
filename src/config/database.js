// Conexión única a MySQL. Sequelize reutiliza este pool en toda la aplicación.
// Las credenciales se cargan desde .env y nunca se registran en consola.
import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false, // Desactiva el logging de SQL en consola
        pool: {
            max: 5, // Máximo de conexiones en el pool
        }
    });