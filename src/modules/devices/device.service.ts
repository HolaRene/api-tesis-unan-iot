import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarDeviceInput,
  CrearDeviceInput,
  Device,
} from './device.types.js';
import { deviceRepository } from './device.repository.js';
import { condicionVisibilidad, type UsuarioAlcance } from '../../utils/alcance.js';

/**
 * Lógica de negocio del módulo de dispositivos.
 *
 * AISLAMIENTO: las operaciones de la API reciben el usuario autenticado. Los
 * métodos internos (watchdog, ingesta IoT) trabajan sin alcance, porque
 * operan por identificador lógico, no por usuario.
 */
export const deviceService = {
  /** Lista los dispositivos visibles para el usuario. */
  async listar(usuario?: UsuarioAlcance | null): Promise<Device[]> {
    return deviceRepository.listar(usuario);
  },

  /**
   * Obtiene un dispositivo por id.
   * 404 si no existe o no es visible para el usuario.
   */
  async obtenerPorId(
    id: string,
    usuario?: UsuarioAlcance | null
  ): Promise<Device> {
    const dispositivo = await deviceRepository.buscarPorId(id, usuario);
    if (!dispositivo) {
      throw ApiError.notFound('Dispositivo no encontrado');
    }
    return dispositivo;
  },

  /**
   * Crea un dispositivo. Valida que el área asociada exista y sea accesible.
   * Se asigna como propietario al usuario autenticado.
   */
  async crear(
    entrada: CrearDeviceInput,
    usuario?: UsuarioAlcance | null
  ): Promise<Device> {
    if (entrada.area_id) {
      await this.verificarArea(entrada.area_id, usuario);
    }
    return deviceRepository.crear({
      ...entrada,
      propietario_id: entrada.propietario_id ?? usuario?.id ?? null,
    });
  },

  /**
   * Actualiza un dispositivo por id (solo el propietario o un admin).
   * Valida el área si cambia.
   */
  async actualizar(
    id: string,
    entrada: ActualizarDeviceInput,
    usuario?: UsuarioAlcance | null
  ): Promise<Device> {
    // Se comprueba el acceso ANTES de validar el área, para no revelar datos.
    await this.obtenerPorId(id, usuario);

    if (entrada.area_id) {
      await this.verificarArea(entrada.area_id, usuario);
    }
    const actualizado = await deviceRepository.actualizar(id, entrada, usuario);
    if (!actualizado) {
      throw ApiError.forbidden('No tiene permisos para modificar este dispositivo');
    }
    return actualizado;
  },

  /** Elimina un dispositivo por id (solo el propietario o un admin). */
  async eliminar(id: string, usuario?: UsuarioAlcance | null): Promise<void> {
    const eliminado = await deviceRepository.eliminar(id, usuario);
    if (!eliminado) {
      const existe = await deviceRepository.buscarPorId(id);
      if (existe) {
        throw ApiError.forbidden(
          'No tiene permisos para eliminar este dispositivo'
        );
      }
      throw ApiError.notFound('Dispositivo no encontrado');
    }
  },

  /**
   * Busca un dispositivo por su identificador lógico (el que usan las
   * integraciones: ESP32-Q2, PLC-01…). Devuelve null si no existe.
   */
  async obtenerPorIdentificador(identificador: string): Promise<Device | null> {
    const r = await query<Device>(
      `SELECT id, area_id, nombre, tipo, fabricante, modelo, identificador,
              protocolo, direccion_ip, estado, metadatos, ultima_conexion, creado_en
       FROM dispositivos WHERE identificador = $1 LIMIT 1`,
      [identificador]
    );
    return r.rows[0] ?? null;
  },

  /**
   * Registra el contacto de un dispositivo (heartbeat o ingesta de mediciones).
   *
   * Marca `estado` (por defecto `online`), actualiza `ultima_conexion = NOW()`
   * y, si se indican, `direccion_ip` y `metadatos` (estos últimos se **fusionan**
   * con los existentes, no se reemplazan).
   *
   * Se identifica por `identificador` lógico. Lanza 404 si no existe.
   */
  async registrarContacto(
    identificador: string,
    datos: {
      estado?: string;
      direccion_ip?: string | null;
      metadatos?: Record<string, unknown> | null;
    } = {}
  ): Promise<{ anterior: Device; actual: Device }> {
    const dispositivo = await this.obtenerPorIdentificador(identificador);
    if (!dispositivo) {
      throw ApiError.notFound(
        `Dispositivo no encontrado por identificador: ${identificador}`
      );
    }

    const estado = datos.estado ?? 'online';
    const metadatosFusionados =
      datos.metadatos && Object.keys(datos.metadatos).length > 0
        ? { ...(dispositivo.metadatos ?? {}), ...datos.metadatos }
        : dispositivo.metadatos;

    const r = await query<Device>(
      `UPDATE dispositivos
       SET estado = $2,
           ultima_conexion = NOW(),
           direccion_ip = COALESCE($3, direccion_ip),
           metadatos = $4
       WHERE id = $1
       RETURNING id, area_id, nombre, tipo, fabricante, modelo, identificador,
                 protocolo, direccion_ip, estado, metadatos, ultima_conexion, creado_en`,
      [
        dispositivo.id,
        estado,
        datos.direccion_ip ?? null,
        metadatosFusionados ? JSON.stringify(metadatosFusionados) : JSON.stringify({}),
      ]
    );
    // Se devuelve también el estado previo: los emisores realtime necesitan
    // comparar (transición online/offline) y decidir si hay cambio relevante.
    return { anterior: dispositivo, actual: r.rows[0] };
  },

  /**
   * Marca como `offline` los dispositivos que llevan más de `minutos` sin
   * registrar contacto (watchdog). No toca dispositivos que ya están offline,
   * por lo que **nunca se repite** la transición.
   *
   * Devuelve los dispositivos afectados junto con su estado anterior, para que
   * el llamador pueda emitir `dispositivo:offline` una sola vez (después del
   * COMMIT).
   */
  async marcarOfflineSinContacto(
    minutos: number
  ): Promise<Array<{ anterior: Device; actual: Device }>> {
    // El CTE captura el estado previo ANTES de actualizar, para poder informar
    // la transición exacta sin una segunda consulta.
    const r = await query<{ anterior: Device; actual: Device }>(
      `WITH previos AS (
         SELECT id, estado FROM dispositivos
         WHERE estado <> 'offline'
           AND ultima_conexion IS NOT NULL
           AND ultima_conexion < NOW() - ($1 || ' minutes')::interval
       ),
       actualizados AS (
         UPDATE dispositivos d
         SET estado = 'offline'
         FROM previos p
         WHERE d.id = p.id
         RETURNING d.id, d.area_id, d.nombre, d.tipo, d.fabricante, d.modelo,
                   d.identificador, d.protocolo, d.direccion_ip, d.estado,
                   d.metadatos, d.ultima_conexion, d.creado_en
       )
       SELECT
         to_jsonb(p.*) AS anterior,
         to_jsonb(a.*) AS actual
       FROM actualizados a
       JOIN previos p ON p.id = a.id`,
      [String(minutos)]
    );
    return r.rows;
  },

  /**
   * Verifica que exista un área con el id dado Y que sea accesible para el
   * usuario (misma regla de visibilidad que al listar áreas).
   *
   * Es importante filtrar por alcance: si no, un usuario podría colgar sus
   * dispositivos de un área ajena y operar sobre ella indirectamente.
   */
  async verificarArea(
    areaId: string,
    usuario?: UsuarioAlcance | null
  ): Promise<void> {
    const cond = condicionVisibilidad('a', 2, usuario);
    const where = cond ? `AND ${cond.sql}` : '';
    const valores = cond ? [areaId, cond.valor] : [areaId];

    const resultado = await query<{ id: string }>(
      `SELECT id FROM areas a WHERE a.id = $1 ${where} LIMIT 1`,
      valores
    );
    if (resultado.rows.length === 0) {
      throw ApiError.badRequest(
        `El área con id ${areaId} no existe o no tiene acceso a ella`
      );
    }
  },
};
