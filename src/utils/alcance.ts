/**
 * Alcance de datos por usuario (propiedad de recursos).
 *
 * Reglas:
 *   - `admin`  → ve y edita TODO (sin filtro).
 *   - resto    → ve solo lo suyo (`propietario_id = usuario.id`) más lo global
 *                (`propietario_id IS NULL`), y solo edita lo suyo.
 *
 * El propietario vive en las tablas RAÍZ (`areas`, `dispositivos`); los
 * recursos hijos heredan la propiedad por su padre (ver migración 0013).
 *
 * Estas funciones construyen fragmentos SQL reutilizables. El `alias` es el
 * alias de la tabla raíz en la consulta (p. ej. `d` para dispositivos).
 */
import type { RolUsuario } from '../modules/users/user.types.js';

/** Identidad mínima necesaria para calcular el alcance. */
export interface UsuarioAlcance {
  id: string;
  rol: RolUsuario;
}

/** ¿El usuario puede ver/editar todos los recursos? */
export function esAlcanceTotal(usuario?: UsuarioAlcance | null): boolean {
  return usuario?.rol === 'admin';
}

/**
 * Condición SQL de VISIBILIDAD para una tabla con `propietario_id`.
 *
 *   admin → `TRUE` (sin restricción)
 *   resto → `alias.propietario_id = $n OR alias.propietario_id IS NULL`
 *
 * Devuelve `null` cuando no hay condición (admin), para que el llamador lo
 * omita sin añadir un `WHERE TRUE`.
 *
 * @param alias     alias de la tabla raíz, p. ej. `'d'`
 * @param indice    número de parámetro a usar ($1, $2…)
 * @param usuario   usuario autenticado
 */
export function condicionVisibilidad(
  alias: string,
  indice: number,
  usuario?: UsuarioAlcance | null
): { sql: string; valor: string } | null {
  // `undefined` o admin → sin filtro (ve todo).
  if (usuario === undefined || esAlcanceTotal(usuario)) return null;
  // `null` explícito → sin visibilidad (no debe usarse para "ver todo").
  if (usuario === null) return { sql: 'FALSE', valor: '' };
  return {
    sql: `(${alias}.propietario_id = $${indice} OR ${alias}.propietario_id IS NULL)`,
    valor: usuario.id,
  };
}

/**
 * Condición SQL de PROPIEDAD ESTRICTA (edición/borrado).
 *
 * Solo el dueño (o un admin) puede modificar. Los recursos globales
 * (`propietario_id IS NULL`) solo los toca un admin.
 *
 * Devuelve `null` para admin (sin restricción).
 */
export function condicionPropiedad(
  alias: string,
  indice: number,
  usuario?: UsuarioAlcance | null
): { sql: string; valor: string } | null {
  // `undefined` o admin → sin restricción.
  if (usuario === undefined || esAlcanceTotal(usuario)) return null;
  // `null` explícito → nunca coincide (defensivo).
  if (usuario === null) return { sql: 'FALSE', valor: '' };
  return { sql: `${alias}.propietario_id = $${indice}`, valor: usuario.id };
}

/**
 * ¿Puede este usuario modificar un recurso con este propietario?
 * Se usa cuando el recurso ya está cargado en memoria (sin ir a SQL).
 */
export function puedeModificar(
  propietarioId: string | null | undefined,
  usuario?: UsuarioAlcance | null
): boolean {
  if (esAlcanceTotal(usuario)) return true;
  if (!usuario) return false;
  // Global (sin dueño) → solo admin (ya cubierto arriba).
  if (propietarioId === null || propietarioId === undefined) return false;
  return propietarioId === usuario.id;
}

/** ¿Puede este usuario VER un recurso con este propietario? */
export function puedeVer(
  propietarioId: string | null | undefined,
  usuario?: UsuarioAlcance | null
): boolean {
  if (esAlcanceTotal(usuario)) return true;
  if (!usuario) return false;
  // Lo global lo ve todo el mundo autenticado.
  if (propietarioId === null || propietarioId === undefined) return true;
  return propietarioId === usuario.id;
}

/**
 * Condición de visibilidad para recursos que HEREDAN la propiedad de un
 * dispositivo mediante una relación (JOIN).
 *
 * Ejemplo para sensores:
 *   JOIN dispositivos d ON d.id = s.dispositivo_id
 *   condicionVisibilidadHeredada('d', 1, usuario)
 *     → `(d.propietario_id = $1 OR d.propietario_id IS NULL)`
 *
 * @param aliasDispositivo alias del JOIN contra `dispositivos`
 */
export function condicionVisibilidadHeredada(
  aliasDispositivo: string,
  indice: number,
  usuario?: UsuarioAlcance | null
): { sql: string; valor: string } | null {
  return condicionVisibilidad(aliasDispositivo, indice, usuario);
}

/**
 * Condición de PROPIEDAD para recursos que heredan de un dispositivo.
 * Se aplica al alias del dispositivo en el JOIN.
 */
export function condicionPropiedadHeredada(
  aliasDispositivo: string,
  indice: number,
  usuario?: UsuarioAlcance | null
): { sql: string; valor: string } | null {
  return condicionPropiedad(aliasDispositivo, indice, usuario);
}
