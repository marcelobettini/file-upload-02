// Punto único para importar modelos y declarar sus asociaciones 1:N.
import { Client } from './Client.js';
import { Case } from './Case.js';
import { Document } from './Document.js';

// Un cliente tiene muchos expedientes; cada expediente pertenece a un cliente.
// Sin onDelete CASCADE: no existen endpoints para borrar clientes ni expedientes.
Client.hasMany(Case, { foreignKey: { name: 'client_id', allowNull: false }, onDelete: 'RESTRICT' });
Case.belongsTo(Client, { foreignKey: { name: 'client_id', allowNull: false } });

// Un expediente contiene muchos documentos. Tampoco se usa CASCADE: borrar filas
// sin borrar los archivos físicos dejaría archivos huérfanos en uploads/.
Case.hasMany(Document, { foreignKey: { name: 'case_id', allowNull: false }, onDelete: 'RESTRICT' });
Document.belongsTo(Case, { foreignKey: { name: 'case_id', allowNull: false } });

export { Client, Case, Document };
