import { query } from '../../database/pool.js';
import type {
  ActuadorConRelaciones,
  ActualizarActuadorInput,
  CrearActuadorInput,
} from './actuador.types.js';

/** Columnas del actuador + relaciones legibles (dispositivo, área). */
const SELECT_ACTUADOR = `
  a.id, a.dispositivo_id, a.nombre, a.codigo, a.tipo,
  a.estado_actual, a.activo, a.configuracion, a.creado_en,
  d.nombre AS dispositivo_nombre,
  d.area_id,
  ar.nombre AS area_nombre
`;

const FROM_ACTUADOR = `
  FROM actuadores a
  LEFT JOIN dispositivos d ON d.id = a.dispositivo_id
  LEFT JOIN areas ar         ON ar.id = d.area_id
`;

/**
 * Repositorio de actuadores. Solo consultas SQL.
 */
export const actuadorRepository = {
  /** Lista actuadores con dispositivo y área legibles. */
  async listar(): Promise<ActuadorConRelaciones[]> {
    const r = await query<ActuadorConRelaciones>(
      `SELECT ${SELECT_ACTUADOR} ${FROM_ACTUADOR} ORDER BY a.creado_en DESC`
    );
    return r.rows;
  },

  /** Busca un actuador por id (con dispositivo y área). */
  async buscarPorId(id: string): Promise<ActuadorConRelaciones | null> {
    const r = await query<ActuadorConRelaciones>(
      `SELECT ${SELECT_ACTUADOR} ${FROM_ACTUADOR} WHERE a.id = $1 LIMIT 1`,
      [id]
    );
    return r.rows[0] ?? null;
  },

  /** Busca un actuador por código (columna única/unica). */
  async buscarPorCodigo(codigo: string): Promise<ActuadorConRelaciones | null> {
    const r = await query<ActuadorConRelaciones>(
      `SELECT ${SELECT_ACTUADOR} ${FROM_ACTUADOR} WHERE a.codigo = $1 LIMIT 1`,
      [codigo]
    );
    return r.rows[0] ?? null;
  },

  /** Inserta y devuelve el actuador con relaciones. */
  async crear(datos: CrearActuadorInput): Promise<ActuadorConRelaciones> {
    const insertado = await query<{ id: string }>(
      `INSERT INTO actuadores
         (dispositivo_id, nombre, codigo, tipo, estado_actual, activo, configuracion)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, TRUE), $7)
       RETURNING id`,
      [
        datos.dispositivo_id,
        datos.nombre,
        datos.codigo,
        datos.tipo,
        datos.estado_actual ?? null,
        datos.activo ?? null,
        datos.configuracion ? JSON.stringify(datos.configuracion) : JSON.stringify({}),
      ]
    );
    const creado = await this.buscarPorId(insertado.rows[0].id);
    return creado as ActuadorConRelaciones;
  },

  /** Actualiza parcialmente un actuador y lo devuelve con relaciones. */
  async actualizar(
    id: string,
    datos: ActualizarActuadorInput
  ): Promise<ActuadorConRelaciones | null> {
    const sets: string[] = [];
    const valores: unknown[] = [];
    let indice = 1;
    const agregar = (campo: string, v: unknown) => {
      sets.push(`${campo} = $${indice++}`);
      valores.push(v);
    };

    if (datos.dispositivo_id !== undefined) agregar('dispositivo_id', datos.dispositivo_id);
    if (datos.nombre !== undefined) agregar('nombre', datos.nombre);
    if (datos.codigo !== undefined) agregar('codigo', datos.codigo);
    if (datos.tipo !== undefined) agregar('tipo', datos.tipo);
    if (datos.estado_actual !== undefined) agregar('estado_actual', datos.estado_actual);
    if (datos.activo !== undefined) agregar('activo', datos.activo);
    if (datos.configuracion !== undefined) {
      agregar('configuracion', JSON.stringify(datos.configuracion));
    }

    if (sets.length === 0) {
      return this.buscarPorId(id);
    }

    valores.push(id);
    const actualizado = await query<{ id: string }>(
      `UPDATE actuadores SET ${sets.join(', ')} WHERE id = $${indice} RETURNING id`,
      valores
    );
    if (!actualizado.rows[0]) return null;
    return this.buscarPorId(actualizado.rows[0].id);
  },

  /** Elimina un actuador. */
  async eliminar(id: string): Promise<boolean> {
    const resultado = await query<{ id: string }>(
      'DELETE FROM actuadores WHERE id = $1 RETURNING id',
      [id]
    );
    return (resultado.rowCount ?? 0) > 0;
  },
};
