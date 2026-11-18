// Modelo Client. Los atributos se nombran igual que las columnas (snake_case)
// para que el JSON de la API coincida con la tabla y con la especificación.
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Client = sequelize.define('Client', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    first_name: { type: DataTypes.STRING(100), allowNull: false },
    last_name: { type: DataTypes.STRING(100), allowNull: false },
    // DNI/CUIT como texto: no se opera aritméticamente y puede tener ceros a la izquierda.
    document_number: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    email: { type: DataTypes.STRING(150), allowNull: true },
    phone: { type: DataTypes.STRING(30), allowNull: true },
}, {
    tableName: 'clients',
    timestamps: false, // la spec no define created_at/updated_at para clients
});
