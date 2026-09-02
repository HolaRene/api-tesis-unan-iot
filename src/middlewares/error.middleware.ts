import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error.js';
import { responderError } from '../utils/api-response.js';
import { env } from '../config/env.js';

/**
 * Middleware global de manejo de errores.
 *
 * - Convierte los errores de validación de Zod en respuestas 400.
 * - Convierte las instancias de ApiError en la respuesta HTTP adecuada.
 * - Oculta los detalles internos del Error en producción.
 *
 * Debe registrarse al final de la cadena de middlewares de Express.
 */
export function middlewareErrores(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  // Errores de validación de Zod
  if (error instanceof ZodError) {
    return responderError(
      res,
      400,
      'Error de validación',
      error.issues.map((issue) => ({
        campo: issue.path.join('.') || '(raíz)',
        mensaje: issue.message,
      }))
    );
  }

  // Errores de negocio con estado HTTP
  if (error instanceof ApiError) {
    return responderError(res, error.statusCode, error.message, error.detalles);
  }

  // Error desconocido
  const esDesarrollo = env.NODE_ENV === 'development';
  console.error('[Error no controlado]', error);

  if (esDesarrollo) {
    const errorComoStack =
      error instanceof Error ? error.stack : String(error);
    return responderError(res, 500, 'Error interno del servidor', {
      error: errorComoStack,
    });
  }

  return responderError(res, 500, 'Error interno del servidor');
}
