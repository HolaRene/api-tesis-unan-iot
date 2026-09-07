import { query } from '../../database/pool.js';
import type {
  SensorConNombres,
  ActualizarSensorInput,
  CrearSensorInput,
} from './sensor.types.js';

/** Filtros opcionales del listado. */
export interface FiltroListarSensor {
  area_id?: string;
  dispositivo_id?: string;
  tipo_variable_id?: string;
  activo?: boolean;
  buscar?: string;
}

/** SELECT principal con relaciones + última medición (LATERAL). */
const SQL_DETALLE = `
  s.id, s.dispositivo_id, s.tipo_variable_id, s.nombre, s.codigo,
  s.fabricante, s.modelo, s.unidad, s.rango_min, s.rango_max,
  s."precision", s.activo, s.configuracion, s.creado_en,
  d.area_id AS area_id,
  a.nombre AS area_nombre, a.tipo AS area_tipo, a.ubicacion AS area_ubicacion,
  d.nombre AS dispositivo_nombre, d.identificador AS dispositivo_identificador,
  d.tipo AS dispositivo_tipo, d.protocolo AS dispositivo_protocolo,
  d.direccion_ip AS dispositivo_direccion_ip, d.estado AS dispositivo_estado,
  d.ultima_conexion AS dispositivo_ultima_conexion,
  tv.codigo AS tipo_codigo, tv.nombre AS tipo_nombre,
  tv.tipo_dato AS tipo_dato, tv.unidad_default AS tipo_unidad,
  ult.id AS ultima_medicion_id,
  ult.valor_numerico AS ultimo_valor_numerico, ult.valor_texto AS ultimo_valor_texto,
  ult.valor_booleano AS ultimo_valor_booleano, ult.calidad AS ultimo_calidad,
  ult.registrado_en AS ultimo_registrado_en,
  cmn.contar AS cantidad_mediciones,
  EXISTS (SELECT 1 FROM alertas ea WHERE ea.sensor_id = s.id AND ea.estado = 'active') AS alerta_activa
`;

const FROM_DETALLE = `
  FROM sensores s
  LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
  LEFT JOIN areas a ON a.id = d.area_id
  LEFT JOIN tipos_variable tv ON tv.id = s.tipo_variable_id
  LEFT JOIN LATERAL (
    SELECT m.id, m.valor_numerico, m.valor_texto, m.valor_booleano, m.calidad, m.registrado_en
    FROM mediciones m WHERE m.sensor_id = s.id ORDER BY m.registrado_en DESC LIMIT 1
  ) ult ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS contar FROM mediciones m WHERE m.sensor_id = s.id
  ) cmn ON true
`;

function construirCondiciones(filtro: FiltroListarSensor) {
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (filtro.area_id) { params.push(filtro.area_id); condiciones.push(`d.area_id = $${params.length}`); }
  if (filtro.dispositivo_id) { params.push(filtro.dispositivo_id); condiciones.push(`s.dispositivo_id = $${params.length}`); }
  if (filtro.tipo_variable_id) { params.push(filtro.tipo_variable_id); condiciones.push(`s.tipo_variable_id = $${params.length}`); }
  if (filtro.activo !== undefined) { params.push(filtro.activo); condiciones.push(`s.activo = $${params.length}`); }
  if (filtro.buscar) { params.push(`%${filtro.buscar}%`); condiciones.push(`(s.nombre ILIKE $${params.length} OR s.codigo ILIKE $${params.length})`); }
  return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', params };
}

/**
 * Repositorio de sensores. Contiene únicamente consultas SQL.
 */
export const sensorRepository = {
  /** Lista sensores con relaciones y última medición (filtros opcionales). */
  async listar(filtro: FiltroListarSensor = {}): Promise<SensorConNombres[]> {
    const { where, params } = construirCondiciones(filtro);
    const sql = `SELECT ${SQL_DETALLE} ${FROM_DETALLE} ${where} ORDER BY s.creado_en DESC`;
    const r = await query<SensorConNombres>(sql, params);
    return r.rows;
  },

  /** Busca un sensor por id (con relaciones y última medición). */
  async buscarPorId(id: string): Promise<SensorConNombres | null> {
    const r = await query<SensorConNombres>(
      `SELECT ${SQL_DETALLE} ${FROM_DETALLE} WHERE s.id = $1 LIMIT 1`,
      [id]
    );
    return r.rows[0] ?? null;
  },

  /** Busca un sensor por código (columna única). */
  async buscarPorCodigo(codigo: string): Promise<SensorConNombres | null> {
    const r = await query<SensorConNombres>(
      `SELECT ${SQL_DETALLE} ${FROM_DETALLE} WHERE s.codigo = $1 LIMIT 1`,
      [codigo]
    );
    return r.rows[0] ?? null;
  },

  /** Inserta un sensor y lo devuelve con detalles. */
  async crear(datos: CrearSensorInput): Promise<SensorConNombres> {
    const insertado = await query<{ id: string }>(
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

  /** Actualiza un sensor y lo devuelve con detalles. */
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

    if (sets.length === 0) return this.buscarPorId(id);

    valores.push(id);
    const actualizado = await query<{ id: string }>(
      `UPDATE sensores SET ${sets.join(', ')} WHERE id = $${indice} RETURNING id`,
      valores
    );
    if (!actualizado.rows[0]) return null;
    return (await this.buscarPorId(actualizado.rows[0].id)) ?? null;
  },

  /** Elimina un sensor. */
  async eliminar(id: string): Promise<boolean> {
    const r = await query<{ id: string }>(
      'DELETE FROM sensores WHERE id = $1 RETURNING id',
      [id]
    );
    return (r.rowCount ?? 0) > 0;
  },
};
