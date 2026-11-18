import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Case = sequelize.define('Case', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    case_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    title: { type: DataTypes.STRING(200), allowNull: false }, // carátula
    description: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.ENUM('OPEN', 'CLOSED'), allowNull: false, defaultValue: 'OPEN' },
    client_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    // Marca de tiempo explícita: desactivamos timestamps automáticos (createdAt/updatedAt)
    // para que la tabla tenga exactamente las columnas de la spec.
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
    tableName: 'cases',
    timestamps: false,
});
