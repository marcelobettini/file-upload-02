import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Un Document es solo el REGISTRO de un archivo: sus metadatos viven en MySQL
// y los bytes viven en disco (uploads/<stored_name>). Los une `stored_name`.
export const Document = sequelize.define('Document', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    case_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    original_name: { type: DataTypes.STRING(255), allowNull: false }, // nombre que envió el cliente
    stored_name: { type: DataTypes.STRING(255), allowNull: false, unique: true }, // UUID + extensión
    mime_type: { type: DataTypes.STRING(100), allowNull: false }, // MIME declarado
    size: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false }, // bytes
    uploaded_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
    tableName: 'documents',
    timestamps: false,
});
