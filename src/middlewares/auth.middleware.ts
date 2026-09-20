import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/api-error.js';
import { verificarToken } from '../utils/jwt.js';

/**
 * Middleware de autenticación JWT.
 *
 * Lee el token del encabezado Authorization (Bearer <token>) o de la cookie
 * "token". Si es válido, inyecta el usuario autenticado en req.usuario y
 * continúa; si no, rechaza la solicitud con 401.
 */
export function middlewareAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const encabezadoAutorizacion = req.headers.authorization;
  const token =
    encabezadoAutorizacion?.startsWith('Bearer ')
      ? encabezadoAutorizacion.slice(7)
      : (req.cookies?.token as string | undefined);

  if (!token) {
    next(ApiError.unauthorized('Token de autenticación no proporcionado'));
    return;
  }

  try {
    const payload = verificarToken(token);
    req.usuario = payload;
    next();
  } catch {
    next(ApiError.unauthorized('Token de autenticación inválido o expirado'));
  }
}
