/**
 * Tipos del módulo de usuarios.
 */

/** Rol de un usuario dentro del sistema (columna `rol`). */
export type RolUsuario = 'admin' | 'operador' | 'viewer';

/**
 * Representa un usuario tal como se almacena en la base de datos.
 * Los nombres de propiedades coinciden con las columnas de la tabla
 * `usuarios` (nombres en español, snake_case).
 */
export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  hash_contra: string;
  rol: RolUsuario;
  activo: boolean;
  creado_en: Date;
}

/** Usuario autenticado inyectado en la solicitud por el middleware JWT. */
export interface UsuarioAutenticado {
  id: string;
  email: string;
  rol: RolUsuario;
}

/** Datos de entrada para crear (registrar) un usuario. */
export interface CrearUsuarioInput {
  nombre: string;
  email: string;
  password: string;
  rol?: RolUsuario;
}

/** Datos de entrada para iniciar sesión. */
export interface LoginInput {
  email: string;
  password: string;
}

/** Campos actualizables de un usuario. */
export interface ActualizarUsuarioInput {
  nombre?: string;
  email?: string;
  password?: string;
  rol?: RolUsuario;
  activo?: boolean;
}
