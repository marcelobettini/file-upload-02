// Error de aplicación con código HTTP y un código legible por máquina.
// Los controladores lo lanzan con `throw` y el errorHandler lo convierte en JSON.
export class HttpError extends Error {
    constructor(status, code, message, details = null) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
