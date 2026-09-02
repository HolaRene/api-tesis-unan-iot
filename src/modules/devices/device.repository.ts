import { query } from '../../database/pool.js';
import type {
  ActualizarDeviceInput,
  CrearDeviceInput,
  Device,
} from './device.types.js';

/** Columnas devueltas en las consultas que mapean a un Dispositivo. */
const CAMPOS_DISPOSITIVO = `
  id, area_id, nombre, tipo, fabricante, modelo, identificador, protocolo,
  direccion_ip, estado, metadatos, ultima_conexion, creado_en`;

/**
 * Repositorio de dispositivos. Contiene únicamente consultas SQL.
 * No maneja lógica de negocio ni HTTP.
 */
export const deviceRepository = {
  /**
   * Lista todos los dispositivos.
   */
  async listar(): Promise<Device[]> {
    const resultado = await query<Device>(
      `SELECT ${CAMPOS_DISPOSITIVO} FROM dispositivos ORDER BY creado_en DESC`
    );
    return resultado.rows;
  },

  /**
   * Busca un dispositivo por id.
   */
  async buscarPorId(id: string): Promise<Device | null> {
    const resultado = await query<Device>(
      `SELECT ${CAMPOS_DISPOSITIVO} FROM dispositivos WHERE id = $1 LIMIT 1`,
      [id]
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Crea un dispositivo y devuelve el registro creado.
   */
  async crear(datos: CrearDeviceInput): Promise<Device> {
    const resultado = await query<Device>(
      `INSERT INTO dispositivos
         (area_id, nombre, tipo, fabricante, modelo, identificador, protocolo,
          direccion_ip, estado, metadatos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'offline'), $10)
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
      ]
    );
    return resultado.rows[0];
  },

  /**
   * Actualiza un dispositivo por id. Construye los SET según los campos.
   */
  async actualizar(id: string, datos: ActualizarDeviceInput): Promise<Device | null> {
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
      return this.buscarPorId(id);
    }

    valores.push(id);
    const resultado = await query<Device>(
      `UPDATE dispositivos SET ${sets.join(', ')}
       WHERE id = $${indice}
       RETURNING ${CAMPOS_DISPOSITIVO}`,
      valores
    );
    return resultado.rows[0] ?? null;
  },

  /**
   * Elimina un dispositivo por id. Devuelve true si existía.
   */
  async eliminar(id: string): Promise<boolean> {
    const resultado = await query<{ id: string }>(
      'DELETE FROM dispositivos WHERE id = $1 RETURNING id',
      [id]
    );
    return (resultado.rowCount ?? 0) > 0;
  },
};
