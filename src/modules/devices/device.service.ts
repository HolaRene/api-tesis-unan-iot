import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarDeviceInput,
  CrearDeviceInput,
  Device,
} from './device.types.js';
import { deviceRepository } from './device.repository.js';
import { condicionVisibilidad, type UsuarioAlcance } from '../../utils/alcance.js';
import {
  identificadorDeDispositivo,
  identificadorUnico,
} from '../../utils/identificadores.js';

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
   *
   * EL IDENTIFICADOR LO GENERA EL SERVIDOR, no el cliente.
   *
   * Es la clave con la que el equipo se identifica al enviar datos
   * (`{"dispositivo": "ESP32-Q2", ...}`) y tiene restricción UNIQUE en toda
   * la base de datos. Si se escribiera a mano habría duplicados, formatos
   * inconsistentes ("temp1", "Temp-1") y fallos con errores de base de datos
   * poco claros.
   *
   * Se deriva del NOMBRE y se le añade un sufijo numérico si ya está ocupado:
   *
   *   "ESP32 Quirófano"  →  "ESP32-QUIROFANO"
   *   (otra vez)         →  "ESP32-QUIROFANO-2"
   *
   * Si el cliente envía un `identificador`, se IGNORA en silencio: así una
   * versión antigua del frontend que aún lo mande sigue funcionando.
   */
  async crear(
    entrada: CrearDeviceInput,
    usuario?: UsuarioAlcance | null
  ): Promise<Device> {
    if (entrada.area_id) {
      await this.verificarArea(entrada.area_id, usuario);
    }

    const base = identificadorDeDispositivo(entrada.nombre);
    const identificador = await identificadorUnico(base, (candidato) =>
      this.identificadorOcupado(candidato)
    );

    return deviceRepository.crear({
      ...entrada,
      identificador,
      propietario_id: entrada.propietario_id ?? usuario?.id ?? null,
    });
  },

  /** ¿Existe ya un dispositivo con ese identificador? */
  async identificadorOcupado(identificador: string): Promise<boolean> {
    const r = await query<{ existe: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM dispositivos WHERE identificador = $1) AS existe',
      [identificador]
    );
    return r.rows[0]?.existe ?? false;
  },

  /**
   * Actualiza un dispositivo por id (solo el propietario o un admin).
   * Valida el área si cambia.
   *
   * El IDENTIFICADOR no se puede cambiar desde aquí.
   *
   * Es la clave con la que el equipo ya está enviando datos: si se modificara,
   * las mediciones nuevas llegarían con un identificador y las antiguas
   * quedarían asociadas al anterior, partiendo el histórico en dos.
   *
   * Si el cliente lo envía, se descarta sin error, para no romper versiones
   * antiguas del frontend.
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

    // Se elimina el identificador del payload de actualización.
    const { identificador: _ignorado, ...datos } = entrada;

    const actualizado = await deviceRepository.actualizar(id, datos, usuario);
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
