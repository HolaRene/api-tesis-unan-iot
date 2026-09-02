import { query } from '../../database/pool.js';
import type {
  ActualizarAreaInput,
  Area,
  CrearAreaInput,
} from './area.types.js';

/** Columnas devueltas en las consultas que mapean a un Área. */
const CAMPOS_AREA = 'id, nombre, tipo, descripcion, ubicacion, activo, creado_en';

/**
 * Repositorio de áreas. Contiene únicamente consultas SQL/PostgreSQL.
 * No maneja lógica de negocio ni HTTP.
 */
export const areaRepository = {
  /**
   * Lista todas las áreas.
   */
  async listar(): Promise<Area[]> {
    const resultado = await query<Area>(
      `SELECT ${CAMPOS_AREA} FROM areas ORDER BY creado_en DESC`
    );
    return resultado.rows;
  },

  /**
   * Busca un área por id.
   */
  async buscarPorId(id: string): Promise<Area | null> {
    const resultado = await query<Area>(
      `SELECT ${CAMPOS_AREA} FROM areas WHERE id = $1 LIMIT 1`,
      [id]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Crea un área y devuelve el registro creado.
   */
  async crear(datos: CrearAreaInput): Promise<Area> {
    const resultado = await query<Area>(
      `INSERT INTO areas (nombre, tipo, descripcion, ubicacion, activo)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE))
       RETURNING ${CAMPOS_AREA}`,
      [datos.nombre, datos.tipo ?? null, datos.descripcion ?? null, datos.ubicacion ?? null, datos.activo ?? null]
    );
    return resultado.rows[0];
  },

  /**
   * Actualiza un área por id. Construye los SET según los campos presentes.
   */
  async actualizar(id: string, datos: ActualizarAreaInput): Promise<Area | null> {
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

    if (sets.length === 0) {
      return this.buscarPorId(id);
    }

    valores.push(id);
    const resultado = await query<Area>(
      `UPDATE areas SET ${sets.join(', ')}
       WHERE id = $${indice}
       RETURNING ${CAMPOS_AREA}`,
      valores
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Elimina un área por id. Devuelve true si existía.
   */
  async eliminar(id: string): Promise<boolean> {
    const resultado = await query<{ id: string }>(
      'DELETE FROM areas WHERE id = $1 RETURNING id',
      [id]
    );
    return (resultado.rowCount ?? 0) > 0;
  },
};
