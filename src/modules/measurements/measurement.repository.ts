import { query } from '../../database/pool.js';
import type {
  CrearMeasurementInput,
  FiltrarMediciones,
  Measurement,
} from './measurement.types.js';

/** Columnas devueltas en las consultas que mapean a una Medición. */
const CAMPOS_MEDICION = `
  id, sensor_id, canal_id, valor_numerico, valor_texto, valor_booleano, valor_json,
  calidad, registrado_en, metadatos`;

/**
 * Repositorio de mediciones. Contiene únicamente consultas SQL.
 * No maneja lógica de negocio ni HTTP.
 */
export const measurementRepository = {
  /**
   * Lista mediciones con filtros opcionales (global).
   * Admite: sensor_id, dispositivo_id, area_id, tipo_variable_id,
   * desde, hasta, limite. Permite orden ascendente para historial de gráficas.
   */
  async listar(filtro: FiltrarMediciones): Promise<Measurement[]> {
    const cond: string[] = [];
    const vals: unknown[] = [];
    const nexo = (v: unknown) => {
      vals.push(v);
      return `$${vals.length}`;
    };

    if (filtro.sensor_id !== undefined) cond.push(`m.sensor_id = ${nexo(filtro.sensor_id)}`);
    if (filtro.dispositivo_id !== undefined) cond.push(`s.dispositivo_id = ${nexo(filtro.dispositivo_id)}`);
    if (filtro.area_id !== undefined) cond.push(`d.area_id = ${nexo(filtro.area_id)}`);
    if (filtro.tipo_variable_id !== undefined) cond.push(`s.tipo_variable_id = ${nexo(filtro.tipo_variable_id)}`);
    if (filtro.desde !== undefined) cond.push(`m.registrado_en >= ${nexo(filtro.desde)}`);
    if (filtro.hasta !== undefined) cond.push(`m.registrado_en <= ${nexo(filtro.hasta)}`);

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const orden = filtro.orden_ascendente ? 'ASC' : 'DESC';
    const limite = filtro.limite ?? 100;

    const sql = `
      SELECT m.id, m.sensor_id, m.valor_numerico, m.valor_texto, m.valor_booleano,
             m.valor_json, m.calidad, m.registrado_en, m.metadatos
      FROM mediciones m
      JOIN sensores s ON s.id = m.sensor_id
      LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
      ${where}
      ORDER BY m.registrado_en ${orden}, m.id ${orden}
      LIMIT ${nexo(limite)}
    `;

    const r = await query<Measurement>(sql, vals);
    return r.rows;
  },

  /**
   * Lista el historial de un solo sensor (orden ascendente para gráfica),
   * permitiendo filtros desde/hasta y limite.
   */
  async listarHistorialSensor(sensorId: string, filtro: { desde?: string; hasta?: string; limite?: number } = {}): Promise<Measurement[]> {
    const cond = ['sensor_id = $1'];
    const vals: unknown[] = [sensorId];
    let indice = 2;
    if (filtro.desde !== undefined) { cond.push(`registrado_en >= $${indice++}`); vals.push(filtro.desde); }
    if (filtro.hasta !== undefined) { cond.push(`registrado_en <= $${indice++}`); vals.push(filtro.hasta); }
    const limite = filtro.limite ?? 100;

    const r = await query<Measurement>(
      `SELECT ${CAMPOS_MEDICION} FROM mediciones
       WHERE ${cond.join(' AND ')}
       ORDER BY registrado_en ASC, id ASC
       LIMIT $${indice}`,
      [...vals, limite]
    );
    return r.rows;
  },

  /**
   * Lista el historial de un canal (orden ascendente para gráfica).
   */
  async listarHistorialCanal(canalId: string, filtro: { desde?: string; hasta?: string; limite?: number } = {}): Promise<Measurement[]> {
    const cond = ['canal_id = $1'];
    const vals: unknown[] = [canalId];
    let indice = 2;
    if (filtro.desde !== undefined) { cond.push(`registrado_en >= $${indice++}`); vals.push(filtro.desde); }
    if (filtro.hasta !== undefined) { cond.push(`registrado_en <= $${indice++}`); vals.push(filtro.hasta); }
    const limite = filtro.limite ?? 100;
    const r = await query<Measurement>(
      `SELECT ${CAMPOS_MEDICION} FROM mediciones
       WHERE ${cond.join(' AND ')}
       ORDER BY registrado_en ASC, id ASC
       LIMIT $${indice}`,
      [...vals, limite]
    );
    return r.rows;
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
         (canal_id, sensor_id, valor_numerico, valor_texto, valor_booleano, valor_json,
          calidad, registrado_en, metadatos)
       VALUES
         ($1, $2, $3, $4, $5, $6, COALESCE($7, 'good'), COALESCE($8, NOW()), $9)
       RETURNING ${CAMPOS_MEDICION}`,
      [
        datos.canal_id ?? null,
        datos.sensor_id ?? null,
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
