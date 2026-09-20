import { query } from '../../database/pool.js';
import type {
  ActualizarCamaraInput,
  CamaraDetalle,
  CrearCamaraInput,
  FiltrarCamaras,
} from './camera.types.js';
import {
  condicionPropiedad,
  condicionVisibilidad,
  type UsuarioAlcance,
} from '../../utils/alcance.js';

/**
 * Columnas devueltas en las consultas que mapean a una Cámara.
 *
 * SEGURIDAD: nunca se exponen credenciales porque el modelo no las
 * almacena (`ruta_stream` es un PATH, no una URL con usuario:clave).
 */
const CAMPOS_CAMARA = `
  c.id, c.nombre, c.descripcion, c.area_id, c.dispositivo_id,
  c.direccion_ip, c.puerto_rtsp, c.protocolo, c.ruta_stream, c.ruta_webrtc,
  c.estado, c.activa, c.ultima_conexion, c.grabacion_habilitada,
  c.metadatos, c.configuracion, c.propietario_id, c.creado_en, c.actualizado_en`;

/** SELECT con relaciones legibles (área y dispositivo) para listado/detalle. */
const SELECT_DETALLE = `
  SELECT ${CAMPOS_CAMARA},
         a.nombre AS area_nombre,
         d.nombre AS dispositivo_nombre,
         d.identificador AS dispositivo_identificador
  FROM camaras c
  LEFT JOIN areas a ON a.id = c.area_id
  LEFT JOIN dispositivos d ON d.id = c.dispositivo_id`;

/**
 * Repositorio de cámaras IP. Contiene únicamente consultas SQL.
 *
 * AISLAMIENTO: las lecturas filtran por `propietario_id` según el usuario
 * (mismo patrón que áreas, dispositivos, sensores…).
 */
export const camaraRepository = {
  /**
   * Lista cámaras visibles para el usuario, con filtros opcionales.
   *   - admin → todas
   *   - resto → las suyas + las globales (`propietario_id IS NULL`)
   */
  async listar(
    filtro: FiltrarCamaras = {},
    usuario?: UsuarioAlcance | null
  ): Promise<CamaraDetalle[]> {
    const cond: string[] = [];
    const valores: unknown[] = [];
    const p = (v: unknown) => {
      valores.push(v);
      return `$${valores.length}`;
    };

    if (filtro.area_id) cond.push(`c.area_id = ${p(filtro.area_id)}`);
    if (filtro.dispositivo_id)
      cond.push(`c.dispositivo_id = ${p(filtro.dispositivo_id)}`);
    if (filtro.estado) cond.push(`c.estado = ${p(filtro.estado)}`);
    if (filtro.activa !== undefined) cond.push(`c.activa = ${p(filtro.activa)}`);
    if (filtro.buscar) {
      const b = `%${filtro.buscar}%`;
      cond.push(`(c.nombre ILIKE ${p(b)} OR c.descripcion ILIKE ${p(b)})`);
    }

    // Aislamiento por propietario.
    const alcance = condicionVisibilidad('c', valores.length + 1, usuario);
    if (alcance) cond.push(alcance.sql.replace(`$${valores.length + 1}`, p(alcance.valor)));

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    const r = await query<CamaraDetalle>(
      `${SELECT_DETALLE} ${where} ORDER BY c.nombre ASC`,
      valores
    );
    return r.rows;
  },

  /**
   * Busca una cámara por id, solo si es visible para el usuario.
   * `undefined` en `usuario` = sin filtro (uso interno).
   */
  async buscarPorId(
    id: string,
    usuario?: UsuarioAlcance | null
  ): Promise<CamaraDetalle | null> {
    const alcance = condicionVisibilidad('c', 2, usuario);
    const where = alcance ? `AND ${alcance.sql}` : '';
    const valores = alcance ? [id, alcance.valor] : [id];

    const r = await query<CamaraDetalle>(
      `${SELECT_DETALLE} WHERE c.id = $1 ${where} LIMIT 1`,
      valores
    );
    return r.rows[0] ?? null;
  },

  /**
   * Busca una cámara por su ruta WebRTC (columna única parcial).
   * Útil para el futuro mapeo desde MediaMTX.
   */
  async buscarPorRutaWebrtc(rutaWebrtc: string): Promise<CamaraDetalle | null> {
    const r = await query<CamaraDetalle>(
      `${SELECT_DETALLE} WHERE c.ruta_webrtc = $1 LIMIT 1`,
      [rutaWebrtc]
    );
    return r.rows[0] ?? null;
  },

  /** Inserta una cámara y devuelve el registro con sus relaciones. */
  async crear(datos: CrearCamaraInput): Promise<CamaraDetalle> {
    const r = await query<{ id: string }>(
      `INSERT INTO camaras
         (nombre, descripcion, area_id, dispositivo_id, direccion_ip,
          puerto_rtsp, protocolo, ruta_stream, ruta_webrtc, estado, activa,
          grabacion_habilitada, metadatos, configuracion, propietario_id)
       VALUES
         ($1, $2, $3, $4, $5, COALESCE($6, 554), COALESCE($7, 'rtsp'),
          $8, $9, COALESCE($10, 'desconectada'), COALESCE($11, TRUE),
          COALESCE($12, FALSE), COALESCE($13, '{}')::jsonb, $14, $15)
       RETURNING id`,
      [
        datos.nombre,
        datos.descripcion ?? null,
        datos.area_id ?? null,
        datos.dispositivo_id ?? null,
        datos.direccion_ip ?? null,
        datos.puerto_rtsp ?? null,
        datos.protocolo ?? null,
        datos.ruta_stream,
        datos.ruta_webrtc ?? null,
        datos.estado ?? null,
        datos.activa ?? null,
        datos.grabacion_habilitada ?? null,
        datos.metadatos ? JSON.stringify(datos.metadatos) : null,
        datos.configuracion ? JSON.stringify(datos.configuracion) : null,
        datos.propietario_id ?? null,
      ]
    );

    const creada = await this.buscarPorId(r.rows[0].id);
    return creada as CamaraDetalle;
  },

  /**
   * Actualiza una cámara, solo si el usuario es su propietario (o admin).
   * Devuelve `null` si no existe o no tiene permiso.
   */
  async actualizar(
    id: string,
    datos: ActualizarCamaraInput,
    usuario?: UsuarioAlcance | null
  ): Promise<CamaraDetalle | null> {
    const sets: string[] = [];
    const valores: unknown[] = [];
    let i = 1;
    const ag = (campo: string, valor: unknown) => {
      sets.push(`${campo} = $${i++}`);
      valores.push(valor);
    };

    if (datos.nombre !== undefined) ag('nombre', datos.nombre);
    if (datos.descripcion !== undefined) ag('descripcion', datos.descripcion);
    if (datos.area_id !== undefined) ag('area_id', datos.area_id);
    if (datos.dispositivo_id !== undefined)
      ag('dispositivo_id', datos.dispositivo_id);
    if (datos.direccion_ip !== undefined)
      ag('direccion_ip', datos.direccion_ip);
    if (datos.puerto_rtsp !== undefined) ag('puerto_rtsp', datos.puerto_rtsp);
    if (datos.protocolo !== undefined) ag('protocolo', datos.protocolo);
    if (datos.ruta_stream !== undefined) ag('ruta_stream', datos.ruta_stream);
    if (datos.ruta_webrtc !== undefined) ag('ruta_webrtc', datos.ruta_webrtc);
    if (datos.estado !== undefined) ag('estado', datos.estado);
    if (datos.activa !== undefined) ag('activa', datos.activa);
    if (datos.grabacion_habilitada !== undefined)
      ag('grabacion_habilitada', datos.grabacion_habilitada);
    if (datos.metadatos !== undefined)
      ag('metadatos', JSON.stringify(datos.metadatos));
    if (datos.configuracion !== undefined)
      ag('configuracion', JSON.stringify(datos.configuracion));

    if (sets.length === 0) return this.buscarPorId(id, usuario);

    // `actualizado_en` se mantiene al día en cada cambio.
    sets.push('actualizado_en = NOW()');

    const cond = condicionPropiedad('camaras', i + 1, usuario);
    valores.push(id);
    if (cond) valores.push(cond.valor);
    const where = cond ? `AND ${cond.sql}` : '';

    const r = await query<{ id: string }>(
      `UPDATE camaras SET ${sets.join(', ')}
       WHERE id = $${i} ${where}
       RETURNING id`,
      valores
    );
    if (!r.rows[0]) return null;
    return this.buscarPorId(r.rows[0].id);
  },

  /**
   * Actualiza SOLO el estado (endpoint dedicado). Marca `ultima_conexion`
   * cuando pasa a `conectada`.
   */
  async actualizarEstado(
    id: string,
    estado: string,
    usuario?: UsuarioAlcance | null
  ): Promise<CamaraDetalle | null> {
    const cond = condicionPropiedad('camaras', 4, usuario);
    const where = cond ? `AND ${cond.sql}` : '';
    const valores: unknown[] = [estado, id];
    if (cond) valores.push(cond.valor);

    // Si pasa a conectada se sella la última conexión; si pasa a error o
    // desconectada se conserva la anterior (histórico).
    const sello =
      estado === 'conectada' ? ', ultima_conexion = NOW()' : '';

    const r = await query<{ id: string }>(
      `UPDATE camaras
       SET estado = $1, actualizado_en = NOW() ${sello}
       WHERE id = $2 ${where}
       RETURNING id`,
      valores
    );
    if (!r.rows[0]) return null;
    return this.buscarPorId(r.rows[0].id);
  },

  /** Elimina una cámara, solo si el usuario es su propietario (o admin). */
  async eliminar(id: string, usuario?: UsuarioAlcance | null): Promise<boolean> {
    const cond = condicionPropiedad('camaras', 2, usuario);
    const where = cond ? `AND ${cond.sql}` : '';
    const valores = cond ? [id, cond.valor] : [id];

    const r = await query<{ id: string }>(
      `DELETE FROM camaras WHERE id = $1 ${where} RETURNING id`,
      valores
    );
    return (r.rowCount ?? 0) > 0;
  },
};
