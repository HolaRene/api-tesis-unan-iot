import { query } from '../../database/pool.js';
import type {
  FilaReglaDetalle,
  CrearReglaInput,
  ActualizarReglaInput,
  FiltroReglas,
} from './regla-alerta.types.js';

const COLUMNAS = `
  r.id, r.canal_id, r.nombre, r.descripcion, r.operador,
  r.valor_referencia_numerico, r.valor_referencia_texto, r.valor_referencia_booleano,
  r.valor_min, r.valor_max, r.severidad, r.mensaje, r.activa, r.retardo_segundos,
  r.creado_en, r.actualizado_en,
  c.codigo AS canal_codigo, c.nombre AS canal_nombre, c.unidad AS canal_unidad,
  tv.nombre AS tipo_nombre, tv.tipo_dato AS tipo_dato,
  d.nombre AS dispositivo_nombre, d.identificador AS dispositivo_identificador,
  a.nombre AS area_nombre
`;
const DESC = `
  FROM reglas_alerta r
  JOIN canales c ON c.id = r.canal_id
  LEFT JOIN tipos_variable tv ON tv.id = c.tipo_variable_id
  LEFT JOIN sensores s ON s.id = c.sensor_id
  LEFT JOIN dispositivos d ON d.id = s.dispositivo_id
  LEFT JOIN areas a ON a.id = d.area_id
`;

function cond(f: FiltroReglas) {
  const cond: string[] = [];
  const vals: unknown[] = [];
  if (f.canal_id) { vals.push(f.canal_id); cond.push(`r.canal_id = $${vals.length}`); }
  if (f.dispositivo_id) { vals.push(f.dispositivo_id); cond.push(`s.dispositivo_id = $${vals.length}`); }
  if (f.activa !== undefined) { vals.push(f.activa); cond.push(`r.activa = $${vals.length}`); }
  return { where: cond.length ? `WHERE ${cond.join(' AND ')}` : '', vals };
}

export const reglaRepository = {
  async listar(f: FiltroReglas = {}): Promise<FilaReglaDetalle[]> {
    const { where, vals } = cond(f);
    const r = await query<FilaReglaDetalle>(
      `SELECT ${COLUMNAS} ${DESC} ${where} ORDER BY r.nombre ASC`, vals
    );
    return r.rows;
  },

  async buscarPorId(id: string): Promise<FilaReglaDetalle | null> {
    const r = await query<FilaReglaDetalle>(`SELECT ${COLUMNAS} ${DESC} WHERE r.id = $1 LIMIT 1`, [id]);
    return r.rows[0] ?? null;
  },

  /** Solo fila base por id (para evaluar). */
  async buscarBasePorId(id: string): Promise<FilaReglaDetalle | null> {
    return this.buscarPorId(id);
  },

  async crear(d: CrearReglaInput): Promise<FilaReglaDetalle> {
    const ins = await query<{ id: string }>(
      `INSERT INTO reglas_alerta
        (canal_id, nombre, descripcion, operador, valor_referencia_numerico,
         valor_referencia_texto, valor_referencia_booleano, valor_min, valor_max,
         severidad, mensaje, activa, retardo_segundos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, COALESCE($12, TRUE), $13)
       RETURNING id`,
      [
        d.canal_id, d.nombre, d.descripcion ?? null, d.operador,
        d.valor_referencia_numerico ?? null, d.valor_referencia_texto ?? null,
        d.valor_referencia_booleano ?? null, d.valor_min ?? null, d.valor_max ?? null,
        d.severidad, d.mensaje ?? null, d.activa ?? null, d.retardo_segundos ?? null,
      ]
    );
    const fila = await this.buscarPorId(ins.rows[0].id);
    return fila as FilaReglaDetalle;
  },

  async actualizar(id: string, d: ActualizarReglaInput): Promise<FilaReglaDetalle | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    const p = (c: string, v: unknown) => { sets.push(`${c} = $${i++}`); vals.push(v); };
    if (d.canal_id !== undefined) p('canal_id', d.canal_id);
    if (d.nombre !== undefined) p('nombre', d.nombre);
    if (d.descripcion !== undefined) p('descripcion', d.descripcion);
    if (d.operador !== undefined) p('operador', d.operador);
    if (d.valor_referencia_numerico !== undefined) p('valor_referencia_numerico', d.valor_referencia_numerico);
    if (d.valor_referencia_texto !== undefined) p('valor_referencia_texto', d.valor_referencia_texto);
    if (d.valor_referencia_booleano !== undefined) p('valor_referencia_booleano', d.valor_referencia_booleano);
    if (d.valor_min !== undefined) p('valor_min', d.valor_min);
    if (d.valor_max !== undefined) p('valor_max', d.valor_max);
    if (d.severidad !== undefined) p('severidad', d.severidad);
    if (d.mensaje !== undefined) p('mensaje', d.mensaje);
    if (d.activa !== undefined) p('activa', d.activa);
    if (d.retardo_segundos !== undefined) p('retardo_segundos', d.retardo_segundos);

    if (sets.length === 0) return this.buscarPorId(id);
    vals.push(id);
    const up = await query<{ id: string }>(
      `UPDATE reglas_alerta SET ${sets.join(', ')}, actualizado_en = NOW() WHERE id = $${i} RETURNING id`,
      vals
    );
    if (!up.rows[0]) return null;
    return (await this.buscarPorId(up.rows[0].id)) ?? null;
  },

  async eliminar(id: string): Promise<boolean> {
    const r = await query<{ id: string }>('DELETE FROM reglas_alerta WHERE id = $1 RETURNING id', [id]);
    return (r.rowCount ?? 0) > 0;
  },
};
