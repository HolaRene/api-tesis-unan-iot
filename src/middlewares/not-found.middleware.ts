import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/api-error.js';

/**
 * Middleware para manejar rutas inexistentes (404).
 *
 * Se registra después de todas las rutas de la aplicación; si la solicitud
 * llega hasta aquí, ninguna ruta coincidió.
 */
export function middlewareNoEncontrado(
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  next(ApiError.notFound('La ruta solicitada no existe'));
}
