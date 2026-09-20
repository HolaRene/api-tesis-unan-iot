import { query } from '../../database/pool.js';
import type {
  FilaCanalDetalle,
  CrearCanalInput,
  ActualizarCanalInput,
  FiltroCanales,
} from './canal.types.js';
import {
  condicionVisibilidadHeredada,
  esAlcanceTotal,
  type UsuarioAlcance,
} from '../../utils/alcance.js';

/** Listado de canales con relaciones + última medición (LATERAL). */
const SELECT_CANAL = `
  c.id, c.sensor_id, c.tipo_variable_id, c.codigo, c.nombre, c.descripcion,
  c.unidad, c.rango_min, c.rango_max, c."precision_valor", c.activo,
  c.configuracion, c.creado_en, c.actualizado_en,
  s.dispositivo_id AS dispositivo_id,
  d.nombre AS dispositivo_nombre, d.identificador AS dispositivo_identificador,
  a.nombre AS area_nombre,
  tv.nombre AS tipo_nombre, tv.codigo AS tipo_codigo, tv.tipo_dato AS tipo_dato,
  tv.unidad_default AS tipo_unidad, tv.categoria AS categoria, tv.permite_reglas AS permite_reglas,
  ult.id AS ultima_medicion_id,
  ult.valor_numerico AS ultimo_valor_numerico, ult.valor_texto AS ultimo_valor_texto,
  ult.valor_booleano AS ultimo_valor_booleano, ult.registrado_en AS ultimo_registrado_en,
  cmn.contar AS cantidad_mediciones,
  FALSE AS alerta_activa -- FASE2: sustituir por EXISTS sobre alertas.canal_id
`;

const FROM_CANAL = `
  FROM canales c
  LEFT JOIN sensores s ON s.id = c.sensor_id
  LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
  LEFT JOIN areas a ON a.id = d.area_id
  LEFT JOIN tipos_variable tv ON tv.id = c.tipo_variable_id
  LEFT JOIN LATERAL (
    SELECT m.id, m.valor_numerico, m.valor_texto, m.valor_booleano, m.registrado_en
    FROM mediciones m WHERE m.canal_id = c.id ORDER BY m.registrado_en DESC LIMIT 1
  ) ult ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS contar FROM mediciones m WHERE m.canal_id = c.id
  ) cmn ON true
`;

function construirCondiciones(f: FiltroCanales, usuario?: UsuarioAlcance | null) {
  const cond: string[] = [];
  const valores: unknown[] = [];
  const p = (v: unknown) => { valores.push(v); return `$${valores.length}`; };
  if (f.sensor_id) cond.push(`c.sensor_id = ${p(f.sensor_id)}`);
  if (f.dispositivo_id) cond.push(`s.dispositivo_id = ${p(f.dispositivo_id)}`);
  if (f.area_id) cond.push(`d.area_id = ${p(f.area_id)}`);
  if (f.tipo_variable_id) cond.push(`c.tipo_variable_id = ${p(f.tipo_variable_id)}`);
  if (f.activo !== undefined) cond.push(`c.activo = ${p(f.activo)}`);
  if (f.buscar) {
    const b = `%${f.buscar}%`;
    cond.push(`(c.nombre ILIKE ${p(b)} OR c.codigo ILIKE ${p(b)})`);
  }

  // Aislamiento: el canal hereda la propiedad de su dispositivo.
  if (!esAlcanceTotal(usuario) && usuario) {
    cond.push(`(d.propietario_id = ${p(usuario.id)} OR d.propietario_id IS NULL)`);
  }

  return { where: cond.length ? `WHERE ${cond.join(' AND ')}` : '', valores };
}

export const canalRepository = {
  /** Lista canales visibles para el usuario (con relaciones). */
  async listar(
    filtro: FiltroCanales = {},
    usuario?: UsuarioAlcance | null
  ): Promise<FilaCanalDetalle[]> {
    const { where, valores } = construirCondiciones(filtro, usuario);
    const r = await query<FilaCanalDetalle>(
      `SELECT ${SELECT_CANAL} ${FROM_CANAL} ${where} ORDER BY c.nombre ASC`,
      valores
    );
    return r.rows;
  },

  /** Canal por id (detalle completo), solo si es visible para el usuario. */
  async buscarPorId(
    id: string,
    usuario?: UsuarioAlcance | null
  ): Promise<FilaCanalDetalle | null> {
    const alcance = usuario ? condicionVisibilidadHeredada('d', 2, usuario) : null;
    const where = alcance ? `AND ${alcance.sql}` : '';
    const valores = alcance ? [id, alcance.valor] : [id];

    const r = await query<FilaCanalDetalle>(
      `SELECT ${SELECT_CANAL} ${FROM_CANAL} WHERE c.id = $1 ${where} LIMIT 1`,
      valores
    );
    return r.rows[0] ?? null;
  },

  /** Canal por codigo. Sin filtro: uso de integraciones (IoT). */
  async buscarPorCodigo(codigo: string): Promise<FilaCanalDetalle | null> {
    const r = await query<FilaCanalDetalle>(
      `SELECT ${SELECT_CANAL} ${FROM_CANAL} WHERE c.codigo = $1 LIMIT 1`,
      [codigo]
    );
    return r.rows[0] ?? null;
  },

  /** Crea canal. */
  async crear(datos: CrearCanalInput): Promise<FilaCanalDetalle> {
    const creado = await query<{ id: string }>(
      `INSERT INTO canales
        (sensor_id, tipo_variable_id, codigo, nombre, descripcion, unidad,
         rango_min, rango_max, precision_valor, activo, configuracion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, COALESCE($10, TRUE), $11)
       RETURNING id`,
      [
        datos.sensor_id ?? null,
        datos.tipo_variable_id ?? null,
        datos.codigo, datos.nombre,
        datos.descripcion ?? null, datos.unidad ?? null,
        datos.rango_min ?? null, datos.rango_max ?? null,
        datos.precision_valor ?? null, datos.activo ?? null,
        datos.configuracion ? JSON.stringify(datos.configuracion) : JSON.stringify({}),
      ]
    );
    const fila = await this.buscarPorId(creado.rows[0].id);
    return fila as FilaCanalDetalle;
  },

  /** Actualiza canal, solo si el usuario tiene acceso (heredado del dispositivo). */
  async actualizar(
    id: string,
    datos: ActualizarCanalInput,
    usuario?: UsuarioAlcance | null
  ): Promise<FilaCanalDetalle | null> {
    const sets: string[] = [];
    const valores: unknown[] = [];
    let i = 1;
    const p = (c: string, v: unknown) => { sets.push(`${c} = $${i++}`); valores.push(v); };

    if (datos.sensor_id !== undefined) p('sensor_id', datos.sensor_id);
    if (datos.tipo_variable_id !== undefined) p('tipo_variable_id', datos.tipo_variable_id);
    if (datos.codigo !== undefined) p('codigo', datos.codigo);
    if (datos.nombre !== undefined) p('nombre', datos.nombre);
    if (datos.descripcion !== undefined) p('descripcion', datos.descripcion);
    if (datos.unidad !== undefined) p('unidad', datos.unidad);
    if (datos.rango_min !== undefined) p('rango_min', datos.rango_min);
    if (datos.rango_max !== undefined) p('rango_max', datos.rango_max);
    if (datos.precision_valor !== undefined) p('precision_valor', datos.precision_valor);
    if (datos.activo !== undefined) p('activo', datos.activo);
    if (datos.configuracion !== undefined) {
      sets.push(`configuracion = $${i++}`);
      valores.push(JSON.stringify(datos.configuracion));
    }
    sets.push(`actualizado_en = NOW()`);

    if (Object.keys(datos).length === 0) return this.buscarPorId(id, usuario);
    if (sets.length === 0) return this.buscarPorId(id, usuario);

    // Aislamiento: se filtra por el dueño del dispositivo del canal.
    const cond = condicionVisibilidadHeredada('prop', i + 1, usuario);
    valores.push(id);
    const filtro = cond
      ? `AND sensor_id IN (SELECT s2.id FROM sensores s2 JOIN dispositivos prop ON prop.id = s2.dispositivo_id WHERE ${cond.sql})`
      : '';
    if (cond) valores.push(cond.valor);

    const r = await query<{ id: string }>(
      `UPDATE canales SET ${sets.join(', ')}
       WHERE id = $${i} ${filtro}
       RETURNING id`,
      valores
    );
    if (!r.rows[0]) return null;
    return (await this.buscarPorId(r.rows[0].id)) ?? null;
  },

  /** Elimina canal, solo si el usuario tiene acceso. */
  async eliminar(id: string, usuario?: UsuarioAlcance | null): Promise<boolean> {
    const cond = condicionVisibilidadHeredada('prop', 2, usuario);
    const filtro = cond
      ? `AND sensor_id IN (SELECT s2.id FROM sensores s2 JOIN dispositivos prop ON prop.id = s2.dispositivo_id WHERE ${cond.sql})`
      : '';
    const valores = cond ? [id, cond.valor] : [id];

    const r = await query<{ id: string }>(
      `DELETE FROM canales WHERE id = $1 ${filtro} RETURNING id`,
      valores
    );
    return (r.rowCount ?? 0) > 0;
  },
};
