/**
 * Utilidades JWT compartidas.
 *
 * Centraliza la verificación del token para que el middleware HTTP y el
 * servidor WebSocket usen exactamente la misma lógica.
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UsuarioAutenticado } from '../modules/users/user.types.js';

/**
 * Verifica un JWT y devuelve su payload tipado.
 * Lanza si el token es inválido o ha expirado.
 */
export function verificarToken(token: string): UsuarioAutenticado {
  return jwt.verify(token, env.JWT_SECRET) as UsuarioAutenticado;
}
