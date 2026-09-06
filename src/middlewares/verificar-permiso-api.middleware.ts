import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/api-error.js';
import type { PermisosClaveApi } from '../modules/claves-api/clave-api.types.js';

/**
 * Middleware de verificación de permiso para integraciones por API Key.
 * Debe usarse DESPUÉS de `autenticarApiKey`.
 *
 * Uso:
 *   ruta.post('/', autenticarApiKey, verificarPermisosApi('mediciones:crear'), ctrl)
 */
export function verificarPermisosApi(...permisosRequeridos: Array<keyof PermisosClaveApi | string>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const integracion = req.claveApi;

    if (!integracion) {
      next(ApiError.unauthorized('No autenticado con API Key'));
      return;
    }

    const tienePermiso = permisosRequeridos.some((permiso) =>
      integracion.permisos ? integracion.permisos[permiso] === true : false
    );

    if (!tienePermiso) {
      next(
        new ApiError(403, 'La API Key no tiene permiso para esta acción', {
          codigo: 'API_KEY_SIN_PERMISO',
          permisosRequeridos,
        })
      );
      return;
    }

    next();
  };
}
