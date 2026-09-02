/**
 * Clase de error de aplicación con estado HTTP.
 *
 * Se utiliza en toda la capa de negocio (services) para señalar errores
 * que deben traducirse a una respuesta HTTP con el código de estado
 * adecuado. El middleware de manejo de errores lo detecta y responde.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly detalles?: unknown;

  constructor(statusCode: number, mensaje: string, detalles?: unknown) {
    super(mensaje);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.detalles = detalles;
  }

  static badRequest(mensaje = 'Solicitud inválida', detalles?: unknown): ApiError {
    return new ApiError(400, mensaje, detalles);
  }

  static unauthorized(mensaje = 'No autorizado'): ApiError {
    return new ApiError(401, mensaje);
  }

  static forbidden(mensaje = 'Acceso prohibido'): ApiError {
    return new ApiError(403, mensaje);
  }

  static notFound(mensaje = 'Recurso no encontrado'): ApiError {
    return new ApiError(404, mensaje);
  }

  static conflict(mensaje = 'Conflicto con el estado actual del recurso'): ApiError {
    return new ApiError(409, mensaje);
  }

  static internal(mensaje = 'Error interno del servidor'): ApiError {
    return new ApiError(500, mensaje);
  }

  static notImplemented(mensaje = 'Funcionalidad no implementada'): ApiError {
    return new ApiError(501, mensaje);
  }
}
