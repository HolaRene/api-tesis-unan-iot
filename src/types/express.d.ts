/**
 * Extensiones de tipos para la solicitud de Express.
 *
 * Este archivo no exporta nada; es un módulo de declaración global que
 * enriquece la interfaz Request con los campos que los middlewares
 * añaden (por ejemplo, el usuario autenticado tras validar el JWT).
 */
import type { UsuarioAutenticado } from '../modules/users/user.types.js';

declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado inyectado por el middleware de autenticación. */
      usuario?: UsuarioAutenticado;
    }
  }
}

export {};
