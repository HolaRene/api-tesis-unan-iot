import { query } from '../../database/pool.js';
import type {
  ActualizarSensorInput,
  CrearSensorInput,
  Sensor,
} from './sensor.types.js';

/**
 * Columnas devueltas en las consultas que mapean a un Sensor.
 * Se usa "precision" entre comillas por compatibilidad con palabras clave.
 */
const CAMPOS_SENSOR = `
  id, dispositivo_id, tipo_variable_id, nombre, codigo, fabricante, modelo,
  unidad, rango_min, rango_max, "precision", activo, configuracion, creado_en`;

/**
 * Repositorio de sensores. Contiene únicamente consultas SQL.
 * No maneja lógica de negocio ni HTTP.
 */
export const sensorRepository = {
  /**
   * Lista todos los sensores.
   */
  async listar(): Promise<Sensor[]> {
    const resultado = await query<Sensor>(
      `SELECT ${CAMPOS_SENSOR} FROM sensores ORDER BY creado_en DESC`
    );
    return resultado.rows;
  },

  /**
   * Busca un sensor por id.
   */
  async buscarPorId(id: string): Promise<Sensor | null> {
    const resultado = await query<Sensor>(
      `SELECT ${CAMPOS_SENSOR} FROM sensores WHERE id = $1 LIMIT 1`,
      [id]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Busca un sensor por código (columna única).
   */
  async buscarPorCodigo(codigo: string): Promise<Sensor | null> {
    const resultado = await query<Sensor>(
      `SELECT ${CAMPOS_SENSOR} FROM sensores WHERE codigo = $1 LIMIT 1`,
      [codigo]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Crea un sensor y devuelve el registro creado.
   */
  async crear(datos: CrearSensorInput): Promise<Sensor> {
    const resultado = await query<Sensor>(
      `INSERT INTO sensores
         (dispositivo_id, tipo_variable_id, nombre, codigo, fabricante, modelo,
          unidad, rango_min, rango_max, "precision", activo, configuracion)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, TRUE), $12)
       RETURNING ${CAMPOS_SENSOR}`,
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
    return resultado.rows[0];
  },

  /**
   * Actualiza un sensor por id. Construye los SET según los campos.
   */
  async actualizar(id: string, datos: ActualizarSensorInput): Promise<Sensor | null> {
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
    const resultado = await query<Sensor>(
      `UPDATE sensores SET ${sets.join(', ')}
       WHERE id = $${indice}
       RETURNING ${CAMPOS_SENSOR}`,
      valores
    );
    return resultado.rows[0] ?? null;
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
