import { query } from '../../database/pool.js';
import type {
  CrearMeasurementInput,
  FiltrarMediciones,
  Measurement,
} from './measurement.types.js';

/** Columnas devueltas en las consultas que mapean a una Medición. */
const CAMPOS_MEDICION = `
  id, sensor_id, valor_numerico, valor_texto, valor_booleano, valor_json,
  calidad, registrado_en, metadatos`;

/**
 * Repositorio de mediciones. Contiene únicamente consultas SQL.
 * No maneja lógica de negocio ni HTTP.
 */
export const measurementRepository = {
  /**
   * Lista mediciones opcionalmente filtradas por sensor y con un límite.
   */
  async listar(filtro: FiltrarMediciones): Promise<Measurement[]> {
    const condiciones: string[] = [];
    const valores: unknown[] = [];

    if (filtro.sensor_id !== undefined) {
      condiciones.push(`sensor_id = $${valores.length + 1}`);
      valores.push(filtro.sensor_id);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const limite = filtro.limite ?? 100;

    const resultado = await query<Measurement>(
      `SELECT ${CAMPOS_MEDICION}
       FROM mediciones
       ${where}
       ORDER BY registrado_en DESC
       LIMIT $${valores.length + 1}`,
      [...valores, limite]
    );
    return resultado.rows;
  },

  /**
   * Busca una medición por id.
   */
  async buscarPorId(id: number): Promise<Measurement | null> {
    const resultado = await query<Measurement>(
      `SELECT ${CAMPOS_MEDICION} FROM mediciones WHERE id = $1 LIMIT 1`,
      [id]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Inserta una medición y devuelve el registro creado.
   * Si no se indica registrado_en, PostgreSQL usa NOW() por defecto.
   */
  async crear(datos: CrearMeasurementInput): Promise<Measurement> {
    const resultado = await query<Measurement>(
      `INSERT INTO mediciones
         (sensor_id, valor_numerico, valor_texto, valor_booleano, valor_json,
          calidad, registrado_en, metadatos)
       VALUES
         ($1, $2, $3, $4, $5, COALESCE($6, 'good'), COALESCE($7, NOW()), $8)
       RETURNING ${CAMPOS_MEDICION}`,
      [
        datos.sensor_id,
        datos.valor_numerico ?? null,
        datos.valor_texto ?? null,
        datos.valor_booleano ?? null,
        datos.valor_json ? JSON.stringify(datos.valor_json) : null,
        datos.calidad ?? 'good',
        datos.registrado_en ?? null,
        datos.metadatos ? JSON.stringify(datos.metadatos) : JSON.stringify({}),
      ]
    );
    return resultado.rows[0];
  },

  /**
   * Elimina una medición por id. Devuelve true si existía.
   */
  async eliminar(id: number): Promise<boolean> {
    const resultado = await query<{ id: number }>(
      'DELETE FROM mediciones WHERE id = $1 RETURNING id',
      [id]
    );
    return (resultado.rowCount ?? 0) > 0;
  },
};
