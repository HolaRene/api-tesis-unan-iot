import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/api-error.js';
import type { RolUsuario } from '../modules/users/user.types.js';

/**
 * Fábrica de middleware de autorización por rol.
 *
 * Restringe el acceso a los roles indicados. Debe usarse DESPUÉS de
 * `middlewareAuth` (que inyecta el usuario en `req.usuario`).
 *
 * Uso:
 *   router.post('/', middlewareAuth, requiereRol('usuario', 'admin'), ctrl.crear);
 */
export function requiereRol(...rolesPermitidos: RolUsuario[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const usuario = req.usuario;

    if (!usuario) {
      next(ApiError.unauthorized('No autenticado'));
      return;
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      next(
        ApiError.forbidden(
          'No tiene permisos para realizar esta acción'
        )
      );
      return;
    }

    next();
  };
}

/** Acceso restringido solo a administradores. */
export function soloAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  requiereRol('admin')(req, res, next);
}

/**
 * Permite escritura (crear/editar/eliminar) a roles de gestión
 * (usuario y admin), excluyendo a `viewer`.
 */
export function puedeEditar(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  requiereRol('usuario', 'admin')(req, res, next);
}
