/**
 * Extensiones de tipos para la solicitud de Express.
 *
 * Este archivo no exporta nada; es un módulo de declaración global que
 * enriquece la interfaz Request con los campos que los middlewares
 * añaden (ej. el usuario autenticado tras el JWT y la integración
 * autenticada por API Key).
 */
import type { UsuarioAutenticado } from '../modules/users/user.types.js';
import type { IntegracionApiKey } from '../modules/claves-api/clave-api.types.js';

declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado inyectado por el middleware de autenticación JWT. */
      usuario?: UsuarioAutenticado;

      /** Integración autenticada por API Key (ruta IoT). */
      claveApi?: IntegracionApiKey;
    }
  }
}

export {};
