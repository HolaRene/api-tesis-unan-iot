import { query } from '../../database/pool.js';
import type {
  ActualizarSensorInput,
  CrearSensorInput,
  SensorConNombres,
  Sensor,
} from './sensor.types.js';

/**
 * Columnas base del sensor + campos relacionados con nombres (JOIN).
 * Se usa "precision" entre comillas por compatibilidad.
 */
const SELECT_SENSOR_DETALLADO = `
  s.id, s.dispositivo_id, s.tipo_variable_id, s.nombre, s.codigo,
  s.fabricante, s.modelo, s.unidad, s.rango_min, s.rango_max,
  s."precision", s.activo, s.configuracion, s.creado_en,
  d.area_id,
  a.nombre AS area_nombre,
  d.nombre AS dispositivo_nombre,
  tv.codigo AS tipo_codigo,
  tv.nombre AS tipo_nombre,
  tv.unidad_default AS tipo_unidad
`;

/**
 * FROM + JOINS usados en las consultas de lectura con nombres.
 */
const FROM_SENSOR_CON_JOIN = `
  FROM sensores s
  LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
  LEFT JOIN areas a         ON a.id = d.area_id
  LEFT JOIN tipos_variable tv ON tv.id = s.tipo_variable_id
`;

/**
 * Repositorio de sensores. Contiene únicamente consultas SQL.
 * No maneja lógica de negocio ni HTTP.
 */
export const sensorRepository = {
  /**
   * Lista todos los sensores con detalles legibles.
   */
  async listar(): Promise<SensorConNombres[]> {
    const resultado = await query<SensorConNombres>(
      `SELECT ${SELECT_SENSOR_DETALLADO} ${FROM_SENSOR_CON_JOIN}
       ORDER BY s.creado_en DESC`
    );
    return resultado.rows;
  },

  /**
   * Busca un sensor por id, con detalles legibles.
   */
  async buscarPorId(id: string): Promise<SensorConNombres | null> {
    const resultado = await query<SensorConNombres>(
      `SELECT ${SELECT_SENSOR_DETALLADO} ${FROM_SENSOR_CON_JOIN}
       WHERE s.id = $1 LIMIT 1`,
      [id]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Busca un sensor por código (columna única), con detalles legibles.
   */
  async buscarPorCodigo(codigo: string): Promise<SensorConNombres | null> {
    const resultado = await query<SensorConNombres>(
      `SELECT ${SELECT_SENSOR_DETALLADO} ${FROM_SENSOR_CON_JOIN}
       WHERE s.codigo = $1 LIMIT 1`,
      [codigo]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Crea un sensor y lo devuelve con detalles legibles.
   */
  async crear(datos: CrearSensorInput): Promise<SensorConNombres> {
    const insertado = await query<Sensor>(
      `INSERT INTO sensores
         (dispositivo_id, tipo_variable_id, nombre, codigo, fabricante, modelo,
          unidad, rango_min, rango_max, "precision", activo, configuracion)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, TRUE), $12)
       RETURNING id`,
      [
        datos.dispositivo_id ?? null,
        datos.tipo_variable_id ?? null,
        datos.nombre,
        datos.codigo,
        datos.fabricante ?? null,
        datos.modelo ?? null,
        datos.unidad ?? null,
        datos.rango_min ?? null,
        datos.rango_max ?? null,
        datos.precision ?? null,
        datos.activo ?? null,
        datos.configuracion ? JSON.stringify(datos.configuracion) : JSON.stringify({}),
      ]
    );
    const creado = await this.buscarPorId(insertado.rows[0].id);
    return creado as SensorConNombres;
  },

  /**
   * Actualiza un sensor por id y lo devuelve con detalles legibles.
   */
  async actualizar(id: string, datos: ActualizarSensorInput): Promise<SensorConNombres | null> {
    const sets: string[] = [];
    const valores: unknown[] = [];
    let indice = 1;

    const agregar = (campo: string, valor: unknown) => {
      sets.push(`${campo} = $${indice++}`);
      valores.push(valor);
    };

    if (datos.dispositivo_id !== undefined) agregar('dispositivo_id', datos.dispositivo_id);
    if (datos.tipo_variable_id !== undefined) agregar('tipo_variable_id', datos.tipo_variable_id);
    if (datos.nombre !== undefined) agregar('nombre', datos.nombre);
    if (datos.codigo !== undefined) agregar('codigo', datos.codigo);
    if (datos.fabricante !== undefined) agregar('fabricante', datos.fabricante);
    if (datos.modelo !== undefined) agregar('modelo', datos.modelo);
    if (datos.unidad !== undefined) agregar('unidad', datos.unidad);
    if (datos.rango_min !== undefined) agregar('rango_min', datos.rango_min);
    if (datos.rango_max !== undefined) agregar('rango_max', datos.rango_max);
    if (datos.precision !== undefined) agregar('"precision"', datos.precision);
    if (datos.activo !== undefined) agregar('activo', datos.activo);
    if (datos.configuracion !== undefined) {
      agregar('configuracion', JSON.stringify(datos.configuracion));
    }

    if (sets.length === 0) {
      return this.buscarPorId(id);
    }

    valores.push(id);
    const actualizado = await query<{ id: string }>(
      `UPDATE sensores SET ${sets.join(', ')}
       WHERE id = $${indice}
       RETURNING id`,
      valores
    );
    if (!actualizado.rows[0]) {
      return null;
    }
    const detalle = await this.buscarPorId(actualizado.rows[0].id);
    return detalle;
  },

  /**
   * Elimina un sensor por id. Devuelve true si existía.
   */
  async eliminar(id: string): Promise<boolean> {
    const resultado = await query<{ id: string }>(
      'DELETE FROM sensores WHERE id = $1 RETURNING id',
      [id]
    );
    return (resultado.rowCount ?? 0) > 0;
  },
};
