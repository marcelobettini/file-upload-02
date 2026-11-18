// Punto único para importar modelos y declarar sus asociaciones 1:N.
import { Client } from './Client.js';
import { Case } from './Case.js';

// Un cliente tiene muchos expedientes; cada expediente pertenece a un cliente.
// Sin onDelete CASCADE: no existen endpoints para borrar clientes ni expedientes.
Client.hasMany(Case, { foreignKey: { name: 'client_id', allowNull: false }, onDelete: 'RESTRICT' });
Case.belongsTo(Client, { foreignKey: { name: 'client_id', allowNull: false } });

export { Client, Case };
