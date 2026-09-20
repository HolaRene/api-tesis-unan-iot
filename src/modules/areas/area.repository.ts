import { query } from '../../database/pool.js';
import type {
  ActualizarAreaInput,
  Area,
  CrearAreaInput,
} from './area.types.js';
import {
  condicionPropiedad,
  condicionVisibilidad,
  type UsuarioAlcance,
} from '../../utils/alcance.js';

/** Columnas devueltas en las consultas que mapean a un Área. */
const CAMPOS_AREA =
  'id, nombre, tipo, descripcion, ubicacion, activo, propietario_id, creado_en';

/**
 * Repositorio de áreas. Contiene únicamente consultas SQL/PostgreSQL.
 * No maneja lógica de negocio ni HTTP.
 *
 * AISLAMIENTO: las consultas de lectura reciben el usuario y filtran por
 * `propietario_id`. Un `admin` no lleva filtro (ve todo).
 */
export const areaRepository = {
  /**
   * Lista las áreas visibles para el usuario.
   *   - admin → todas
   *   - resto → las suyas + las globales (`propietario_id IS NULL`)
   */
  async listar(usuario?: UsuarioAlcance | null): Promise<Area[]> {
    const cond = condicionVisibilidad('a', 1, usuario);
    const where = cond ? `WHERE ${cond.sql}` : '';
    const valores = cond ? [cond.valor] : [];

    const resultado = await query<Area>(
      `SELECT ${CAMPOS_AREA} FROM areas a ${where} ORDER BY creado_en DESC`,
      valores
    );
    return resultado.rows;
  },

  /**
   * Busca un área por id, solo si es visible para el usuario.
   * Devuelve `null` si no existe o no tiene acceso (evita filtrar existencia).
   */
  async buscarPorId(
    id: string,
    usuario?: UsuarioAlcance | null
  ): Promise<Area | null> {
    const cond = condicionVisibilidad('a', 2, usuario);
    const where = cond ? `AND ${cond.sql}` : '';
    const valores = cond ? [id, cond.valor] : [id];

    const resultado = await query<Area>(
      `SELECT ${CAMPOS_AREA} FROM areas a WHERE a.id = $1 ${where} LIMIT 1`,
      valores
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Crea un área y devuelve el registro creado.
   * El `propietario_id` lo inyecta el servicio (usuario autenticado).
   */
  async crear(datos: CrearAreaInput): Promise<Area> {
    const resultado = await query<Area>(
      `INSERT INTO areas (nombre, tipo, descripcion, ubicacion, activo, propietario_id)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), $6)
       RETURNING ${CAMPOS_AREA}`,
      [
        datos.nombre,
        datos.tipo ?? null,
        datos.descripcion ?? null,
        datos.ubicacion ?? null,
        datos.activo ?? null,
        datos.propietario_id ?? null,
      ]
    );
    return resultado.rows[0];
  },

  /**
   * Actualiza un área por id, solo si el usuario es su propietario (o admin).
   * Devuelve `null` si no existe o no tiene permiso.
   */
  async actualizar(
    id: string,
    datos: ActualizarAreaInput,
    usuario?: UsuarioAlcance | null
  ): Promise<Area | null> {
    const sets: string[] = [];
    const valores: unknown[] = [];
    let indice = 1;

    if (datos.nombre !== undefined) {
      sets.push(`nombre = $${indice++}`);
      valores.push(datos.nombre);
    }
    if (datos.tipo !== undefined) {
      sets.push(`tipo = $${indice++}`);
      valores.push(datos.tipo);
    }
    if (datos.descripcion !== undefined) {
      sets.push(`descripcion = $${indice++}`);
      valores.push(datos.descripcion);
    }
    if (datos.ubicacion !== undefined) {
      sets.push(`ubicacion = $${indice++}`);
      valores.push(datos.ubicacion);
    }
    if (datos.activo !== undefined) {
      sets.push(`activo = $${indice++}`);
      valores.push(datos.activo);
    }

    const cond = condicionPropiedad('areas', indice + 1, usuario);

    if (sets.length === 0) {
      // Nada que actualizar: se respeta el alcance al devolver el recurso.
      return this.buscarPorId(id, usuario);
    }

    valores.push(id);
    if (cond) valores.push(cond.valor);
    const where = cond ? `AND ${cond.sql}` : '';

    const resultado = await query<Area>(
      `UPDATE areas SET ${sets.join(', ')}
       WHERE id = $${indice} ${where}
       RETURNING ${CAMPOS_AREA}`,
      valores
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Elimina un área por id, solo si el usuario es su propietario (o admin).
   * Devuelve true si se eliminó algo.
   */
  async eliminar(id: string, usuario?: UsuarioAlcance | null): Promise<boolean> {
    const cond = condicionPropiedad('areas', 2, usuario);
    const where = cond ? `AND ${cond.sql}` : '';
    const valores = cond ? [id, cond.valor] : [id];

    const resultado = await query<{ id: string }>(
      `DELETE FROM areas WHERE id = $1 ${where} RETURNING id`,
      valores
    );
    return (resultado.rowCount ?? 0) > 0;
  },
};
