import { query } from '../../database/pool.js';
import type {
  ActualizarAreaInput,
  Area,
  CrearAreaInput,
} from './area.types.js';
import {
  condicionPropiedad,
  condicionVisibilidad,
  type UsuarioAlcance,
} from '../../utils/alcance.js';

/** Columnas devueltas en las consultas que mapean a un Área. */
const CAMPOS_AREA =
  'id, nombre, tipo, descripcion, ubicacion, activo, perfil_alerta, propietario_id, creado_en';

/**
 * Repositorio de áreas. Contiene únicamente consultas SQL/PostgreSQL.
 * No maneja lógica de negocio ni HTTP.
 *
 * AISLAMIENTO: las consultas de lectura reciben el usuario y filtran por
 * `propietario_id`. Un `admin` no lleva filtro (ve todo).
 */
export const areaRepository = {
  /**
   * Lista las áreas visibles para el usuario.
   *   - admin → todas
   *   - resto → las suyas + las globales (`propietario_id IS NULL`)
   */
  async listar(usuario?: UsuarioAlcance | null): Promise<Area[]> {
    const cond = condicionVisibilidad('a', 1, usuario);
    const where = cond ? `WHERE ${cond.sql}` : '';
    const valores = cond ? [cond.valor] : [];

    const resultado = await query<Area>(
      `SELECT ${CAMPOS_AREA} FROM areas a ${where} ORDER BY creado_en DESC`,
      valores
    );
    return resultado.rows;
  },

  /**
   * Busca un área por id, solo si es visible para el usuario.
   * Devuelve `null` si no existe o no tiene acceso (evita filtrar existencia).
   */
  async buscarPorId(
    id: string,
    usuario?: UsuarioAlcance | null
  ): Promise<Area | null> {
    const cond = condicionVisibilidad('a', 2, usuario);
    const where = cond ? `AND ${cond.sql}` : '';
    const valores = cond ? [id, cond.valor] : [id];

    const resultado = await query<Area>(
      `SELECT ${CAMPOS_AREA} FROM areas a WHERE a.id = $1 ${where} LIMIT 1`,
      valores
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Crea un área y devuelve el registro creado.
   * El `propietario_id` lo inyecta el servicio (usuario autenticado).
   */
  async crear(datos: CrearAreaInput): Promise<Area> {
    const resultado = await query<Area>(
      `INSERT INTO areas (nombre, tipo, descripcion, ubicacion, activo, perfil_alerta, propietario_id)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), $6, $7)
       RETURNING ${CAMPOS_AREA}`,
      [
        datos.nombre,
        datos.tipo ?? null,
        datos.descripcion ?? null,
        datos.ubicacion ?? null,
        datos.activo ?? null,
        datos.perfil_alerta ?? null,
        datos.propietario_id ?? null,
      ]
    );
    return resultado.rows[0];
  },

  /**
   * Actualiza un área por id, solo si el usuario es su propietario (o admin).
   * Devuelve `null` si no existe o no tiene permiso.
   */
  async actualizar(
    id: string,
    datos: ActualizarAreaInput,
    usuario?: UsuarioAlcance | null
  ): Promise<Area | null> {
    const sets: string[] = [];
    const valores: unknown[] = [];
    let indice = 1;

    if (datos.nombre !== undefined) {
      sets.push(`nombre = $${indice++}`);
      valores.push(datos.nombre);
    }
    if (datos.tipo !== undefined) {
      sets.push(`tipo = $${indice++}`);
      valores.push(datos.tipo);
    }
    if (datos.descripcion !== undefined) {
      sets.push(`descripcion = $${indice++}`);
      valores.push(datos.descripcion);
    }
    if (datos.ubicacion !== undefined) {
      sets.push(`ubicacion = $${indice++}`);
      valores.push(datos.ubicacion);
    }
    if (datos.perfil_alerta !== undefined) {
      sets.push(`perfil_alerta = $${indice++}`);
      valores.push(datos.perfil_alerta);
    }
    if (datos.activo !== undefined) {
      sets.push(`activo = $${indice++}`);
      valores.push(datos.activo);
    }

    const cond = condicionPropiedad('areas', indice + 1, usuario);

    if (sets.length === 0) {
      // Nada que actualizar: se respeta el alcance al devolver el recurso.
      return this.buscarPorId(id, usuario);
    }

    valores.push(id);
    if (cond) valores.push(cond.valor);
    const where = cond ? `AND ${cond.sql}` : '';

    const resultado = await query<Area>(
      `UPDATE areas SET ${sets.join(', ')}
       WHERE id = $${indice} ${where}
       RETURNING ${CAMPOS_AREA}`,
      valores
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Elimina un área por id, solo si el usuario es su propietario (o admin).
   * Devuelve true si se eliminó algo.
   */
  async eliminar(id: string, usuario?: UsuarioAlcance | null): Promise<boolean> {
    const cond = condicionPropiedad('areas', 2, usuario);
    const where = cond ? `AND ${cond.sql}` : '';
    const valores = cond ? [id, cond.valor] : [id];

    const resultado = await query<{ id: string }>(
      `DELETE FROM areas WHERE id = $1 ${where} RETURNING id`,
      valores
    );
    return (resultado.rowCount ?? 0) > 0;
  },

  /**
   * Último valor de cada magnitud presente en un área.
   *
   * Recorre área → dispositivo → sensor → canal → medición, y por cada tipo
   * de variable se queda con la medición más reciente. Se usa para comparar
   * el valor actual contra la banda del perfil normativo.
   *
   * `LEFT JOIN LATERAL` (y no un MAX agrupado) porque interesa el valor
   * junto con su fecha: una lectura correcta de hace tres días no acredita
   * que hoy se cumpla la norma, y la vista debe poder avisar de ello.
   */
  async ultimosValoresPorMagnitud(areaId: string): Promise<
    { codigo: string; nombre: string; unidad: string | null; valor: number | null; medido_en: Date | null }[]
  > {
    const r = await query<{
      codigo: string;
      nombre: string;
      unidad: string | null;
      valor: number | null;
      medido_en: Date | null;
    }>(
      `SELECT DISTINCT ON (t.codigo)
              t.codigo,
              t.nombre,
              t.unidad_default AS unidad,
              ult.valor_numerico AS valor,
              ult.registrado_en  AS medido_en
         FROM tipos_variable t
         JOIN canales c       ON c.tipo_variable_id = t.id
         JOIN sensores s      ON s.id = c.sensor_id
         JOIN dispositivos d  ON d.id = s.dispositivo_id
         LEFT JOIN LATERAL (
           SELECT m.valor_numerico, m.registrado_en
             FROM mediciones m
            WHERE m.canal_id = c.id
            ORDER BY m.registrado_en DESC
            LIMIT 1
         ) ult ON TRUE
        WHERE d.area_id = $1
        ORDER BY t.codigo, ult.registrado_en DESC NULLS LAST`,
      [areaId]
    );
    return r.rows;
  },
};
