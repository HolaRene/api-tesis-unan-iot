import { query } from '../../database/pool.js';
import type {
  ActualizarDeviceInput,
  CrearDeviceInput,
  Device,
} from './device.types.js';
import {
  condicionPropiedad,
  condicionVisibilidad,
  type UsuarioAlcance,
} from '../../utils/alcance.js';

/** Columnas devueltas en las consultas que mapean a un Dispositivo. */
const CAMPOS_DISPOSITIVO = `
  id, area_id, nombre, tipo, fabricante, modelo, identificador, protocolo,
  direccion_ip, estado, metadatos, ultima_conexion, propietario_id, creado_en`;

/**
 * Repositorio de dispositivos. Contiene únicamente consultas SQL.
 * No maneja lógica de negocio ni HTTP.
 *
 * AISLAMIENTO: las lecturas filtran por `propietario_id` según el usuario.
 */
export const deviceRepository = {
  /**
   * Lista los dispositivos visibles para el usuario.
   *   - admin → todos
   *   - resto → los suyos + los globales (`propietario_id IS NULL`)
   */
  async listar(usuario?: UsuarioAlcance | null): Promise<Device[]> {
    const cond = condicionVisibilidad('d', 1, usuario);
    const where = cond ? `WHERE ${cond.sql}` : '';
    const valores = cond ? [cond.valor] : [];

    const resultado = await query<Device>(
      `SELECT ${CAMPOS_DISPOSITIVO} FROM dispositivos d ${where} ORDER BY creado_en DESC`,
      valores
    );
    return resultado.rows;
  },

  /**
   * Busca un dispositivo por id, solo si es visible para el usuario.
   * Devuelve `null` si no existe o no tiene acceso.
   */
  async buscarPorId(
    id: string,
    usuario?: UsuarioAlcance | null
  ): Promise<Device | null> {
    const cond = condicionVisibilidad('d', 2, usuario);
    const where = cond ? `AND ${cond.sql}` : '';
    const valores = cond ? [id, cond.valor] : [id];

    const resultado = await query<Device>(
      `SELECT ${CAMPOS_DISPOSITIVO} FROM dispositivos d WHERE d.id = $1 ${where} LIMIT 1`,
      valores
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Crea un dispositivo y devuelve el registro creado.
   * El `propietario_id` lo inyecta el servicio (usuario autenticado).
   */
  async crear(datos: CrearDeviceInput): Promise<Device> {
    const resultado = await query<Device>(
      `INSERT INTO dispositivos
         (area_id, nombre, tipo, fabricante, modelo, identificador, protocolo,
          direccion_ip, estado, metadatos, propietario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'offline'), $10, $11)
       RETURNING ${CAMPOS_DISPOSITIVO}`,
      [
        datos.area_id ?? null,
        datos.nombre,
        datos.tipo,
        datos.fabricante ?? null,
        datos.modelo ?? null,
        datos.identificador ?? null,
        datos.protocolo ?? null,
        datos.direccion_ip ?? null,
        datos.estado ?? 'offline',
        datos.metadatos ? JSON.stringify(datos.metadatos) : JSON.stringify({}),
        datos.propietario_id ?? null,
      ]
    );
    return resultado.rows[0];
  },

  /**
   * Actualiza un dispositivo por id, solo si el usuario es su propietario
   * (o admin). Construye los SET según los campos presentes.
   */
  async actualizar(
    id: string,
    datos: ActualizarDeviceInput,
    usuario?: UsuarioAlcance | null
  ): Promise<Device | null> {
    const sets: string[] = [];
    const valores: unknown[] = [];
    let indice = 1;

    const agregar = (campo: string, valor: unknown) => {
      sets.push(`${campo} = $${indice++}`);
      valores.push(valor);
    };

    if (datos.area_id !== undefined) agregar('area_id', datos.area_id);
    if (datos.nombre !== undefined) agregar('nombre', datos.nombre);
    if (datos.tipo !== undefined) agregar('tipo', datos.tipo);
    if (datos.fabricante !== undefined) agregar('fabricante', datos.fabricante);
    if (datos.modelo !== undefined) agregar('modelo', datos.modelo);
    if (datos.identificador !== undefined) agregar('identificador', datos.identificador);
    if (datos.protocolo !== undefined) agregar('protocolo', datos.protocolo);
    if (datos.direccion_ip !== undefined) agregar('direccion_ip', datos.direccion_ip);
    if (datos.estado !== undefined) agregar('estado', datos.estado);
    if (datos.ultima_conexion !== undefined) agregar('ultima_conexion', datos.ultima_conexion);
    if (datos.metadatos !== undefined) {
      agregar('metadatos', JSON.stringify(datos.metadatos));
    }

    if (sets.length === 0) {
      // Nada que actualizar: se respeta el alcance al devolver el recurso.
      return this.buscarPorId(id, usuario);
    }

    const cond = condicionPropiedad('dispositivos', indice + 1, usuario);

    valores.push(id);
    if (cond) valores.push(cond.valor);
    const where = cond ? `AND ${cond.sql}` : '';

    const resultado = await query<Device>(
      `UPDATE dispositivos SET ${sets.join(', ')}
       WHERE id = $${indice} ${where}
       RETURNING ${CAMPOS_DISPOSITIVO}`,
      valores
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Elimina un dispositivo por id, solo si el usuario es su propietario
   * (o admin). Devuelve true si se eliminó algo.
   */
  async eliminar(id: string, usuario?: UsuarioAlcance | null): Promise<boolean> {
    const cond = condicionPropiedad('dispositivos', 2, usuario);
    const where = cond ? `AND ${cond.sql}` : '';
    const valores = cond ? [id, cond.valor] : [id];

    const resultado = await query<{ id: string }>(
      `DELETE FROM dispositivos WHERE id = $1 ${where} RETURNING id`,
      valores
    );
    return (resultado.rowCount ?? 0) > 0;
  },
};
