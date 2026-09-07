import { query } from '../../database/pool.js';
import type {
  ActualizarAlertInput,
  Alert,
  CrearAlertInput,
} from './alert.types.js';

/** Columnas devueltas en las consultas que mapean a una Alerta. */
const CAMPOS_ALERTA = `
  id, sensor_id, canal_id, regla_id, medicion_id, tipo, severidad, mensaje, estado,
  iniciada_en, reconocida_en, reconocida_por, finalizada_en, metadatos`;

/**
 * Repositorio de alertas. Contiene únicamente consultas SQL.
 * No maneja lógica de negocio ni HTTP.
 */
export const alertRepository = {
  /**
   * Lista todas las alertas.
   */
  async listar(): Promise<Alert[]> {
    const resultado = await query<Alert>(
      `SELECT ${CAMPOS_ALERTA} FROM alertas ORDER BY iniciada_en DESC`
    );
    return resultado.rows;
  },

  /**
   * Busca una alerta por id.
   */
  async buscarPorId(id: string): Promise<Alert | null> {
    const resultado = await query<Alert>(
      `SELECT ${CAMPOS_ALERTA} FROM alertas WHERE id = $1 LIMIT 1`,
      [id]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Crea una alerta y devuelve el registro creado.
   */
  async crear(datos: CrearAlertInput): Promise<Alert> {
    const resultado = await query<Alert>(
      `INSERT INTO alertas
         (sensor_id, medicion_id, tipo, severidad, mensaje, estado,
          reconocida_en, finalizada_en, metadatos)
       VALUES
         ($1, $2, $3, $4, $5, COALESCE($6, 'active'), $7, $8, $9)
       RETURNING ${CAMPOS_ALERTA}`,
      [
        datos.sensor_id ?? null,
        datos.medicion_id ?? null,
        datos.tipo ?? null,
        datos.severidad ?? null,
        datos.mensaje ?? null,
        datos.estado ?? 'active',
        datos.reconocida_en ?? null,
        datos.finalizada_en ?? null,
        datos.metadatos ? JSON.stringify(datos.metadatos) : JSON.stringify({}),
      ]
    );
    return resultado.rows[0];
  },

  /**
   * Crea una alerta vinculada a un canal + regla (modelo multivariable).
   */
  async crearDesdeRegla(datos: {
    regla_id: string;
    canal_id: string;
    medicion_id: number;
    severidad: string;
    mensaje: string;
    valor_numerico: number | null;
    valor_texto: string | null;
    valor_booleano: boolean | null;
  }): Promise<Alert> {
    const r = await query<Alert>(
      `INSERT INTO alertas
         (regla_id, canal_id, medicion_id, tipo, severidad, mensaje, estado,
          valor_disparador_numerico, valor_disparador_texto, valor_disparador_booleano,
          metadatos)
       VALUES ($1,$2,$3,'regla',$4,$5,'active',$6,$7,$8, '{}')
       RETURNING *`,
      [
        datos.regla_id, datos.canal_id, datos.medicion_id, datos.severidad,
        datos.mensaje, datos.valor_numerico, datos.valor_texto, datos.valor_booleano,
      ]
    );
    return r.rows[0];
  },

  /** Busca una alerta activa para una regla (para no duplicar). */
  async buscarActivaPorRegla(reglaId: string): Promise<Alert | null> {
    const r = await query<Alert>(
      `SELECT * FROM alertas WHERE regla_id = $1 AND estado = 'active' ORDER BY iniciada_en DESC LIMIT 1`,
      [reglaId]
    );
    return r.rows[0] ?? null;
  },

  /** Marca como resuelta la alerta activa de una regla. */
  async resolverPorRegla(reglaId: string): Promise<void> {
    await query(
      `UPDATE alertas SET estado = 'resolved', finalizada_en = NOW()
       WHERE regla_id = $1 AND estado IN ('active','acknowledged')`,
      [reglaId]
    );
  },

  async actualizar(id: string, datos: ActualizarAlertInput): Promise<Alert | null> {
    const sets: string[] = [];
    const valores: unknown[] = [];
    let indice = 1;

    const agregar = (campo: string, valor: unknown) => {
      sets.push(`${campo} = $${indice++}`);
      valores.push(valor);
    };

    if (datos.sensor_id !== undefined) agregar('sensor_id', datos.sensor_id);
    if (datos.medicion_id !== undefined) agregar('medicion_id', datos.medicion_id);
    if (datos.tipo !== undefined) agregar('tipo', datos.tipo);
    if (datos.severidad !== undefined) agregar('severidad', datos.severidad);
    if (datos.mensaje !== undefined) agregar('mensaje', datos.mensaje);
    if (datos.estado !== undefined) agregar('estado', datos.estado);
    if (datos.reconocida_en !== undefined) agregar('reconocida_en', datos.reconocida_en);
    if (datos.reconocida_por !== undefined) agregar('reconocida_por', datos.reconocida_por);
    if (datos.finalizada_en !== undefined) agregar('finalizada_en', datos.finalizada_en);
    if (datos.metadatos !== undefined) {
      agregar('metadatos', JSON.stringify(datos.metadatos));
    }

    if (sets.length === 0) {
      return this.buscarPorId(id);
    }

    valores.push(id);
    const resultado = await query<Alert>(
      `UPDATE alertas SET ${sets.join(', ')}
       WHERE id = $${indice}
       RETURNING ${CAMPOS_ALERTA}`,
      valores
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Elimina una alerta por id. Devuelve true si existía.
   */
  async eliminar(id: string): Promise<boolean> {
    const resultado = await query<{ id: string }>(
      'DELETE FROM alertas WHERE id = $1 RETURNING id',
      [id]
    );
    return (resultado.rowCount ?? 0) > 0;
  },
};
