import { query } from '../../database/pool.js';
import type {
  ActualizarThresholdInput,
  CrearThresholdInput,
  Threshold,
} from './threshold.types.js';

/** Columnas devueltas en las consultas que mapean a un Umbral. */
const CAMPOS_UMBRAL = 'id, sensor_id, valor_min, valor_max, severidad, activo, creado_en';

/**
 * Repositorio de umbrales. Contiene únicamente consultas SQL.
 * No maneja lógica de negocio ni HTTP.
 */
export const thresholdRepository = {
  /**
   * Lista todos los umbrales.
   */
  async listar(): Promise<Threshold[]> {
    const resultado = await query<Threshold>(
      `SELECT ${CAMPOS_UMBRAL} FROM umbrales ORDER BY creado_en DESC`
    );
    return resultado.rows;
  },

  /**
   * Busca un umbral por id.
   */
  async buscarPorId(id: string): Promise<Threshold | null> {
    const resultado = await query<Threshold>(
      `SELECT ${CAMPOS_UMBRAL} FROM umbrales WHERE id = $1 LIMIT 1`,
      [id]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Crea un umbral y devuelve el registro creado.
   */
  async crear(datos: CrearThresholdInput): Promise<Threshold> {
    const resultado = await query<Threshold>(
      `INSERT INTO umbrales (sensor_id, valor_min, valor_max, severidad, activo)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE))
       RETURNING ${CAMPOS_UMBRAL}`,
      [datos.sensor_id ?? null, datos.valor_min ?? null, datos.valor_max ?? null, datos.severidad ?? null, datos.activo ?? null]
    );
    return resultado.rows[0];
  },

  /**
   * Actualiza un umbral por id. Construye los SET según los campos.
   */
  async actualizar(id: string, datos: ActualizarThresholdInput): Promise<Threshold | null> {
    const sets: string[] = [];
    const valores: unknown[] = [];
    let indice = 1;

    const agregar = (campo: string, valor: unknown) => {
      sets.push(`${campo} = $${indice++}`);
      valores.push(valor);
    };

    if (datos.sensor_id !== undefined) agregar('sensor_id', datos.sensor_id);
    if (datos.valor_min !== undefined) agregar('valor_min', datos.valor_min);
    if (datos.valor_max !== undefined) agregar('valor_max', datos.valor_max);
    if (datos.severidad !== undefined) agregar('severidad', datos.severidad);
    if (datos.activo !== undefined) agregar('activo', datos.activo);

    if (sets.length === 0) {
      return this.buscarPorId(id);
    }

    valores.push(id);
    const resultado = await query<Threshold>(
      `UPDATE umbrales SET ${sets.join(', ')}
       WHERE id = $${indice}
       RETURNING ${CAMPOS_UMBRAL}`,
      valores
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Elimina un umbral por id. Devuelve true si existía.
   */
  async eliminar(id: string): Promise<boolean> {
    const resultado = await query<{ id: string }>(
      'DELETE FROM umbrales WHERE id = $1 RETURNING id',
      [id]
    );
    return (resultado.rowCount ?? 0) > 0;
  },
};
