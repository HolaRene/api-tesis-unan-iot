import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarDeviceInput,
  CrearDeviceInput,
  Device,
} from './device.types.js';
import { deviceRepository } from './device.repository.js';

/**
 * Lógica de negocio del módulo de dispositivos.
 */
export const deviceService = {
  /**
   * Lista todos los dispositivos.
   */
  async listar(): Promise<Device[]> {
    return deviceRepository.listar();
  },

  /**
   * Obtiene un dispositivo por id.
   */
  async obtenerPorId(id: string): Promise<Device> {
    const dispositivo = await deviceRepository.buscarPorId(id);
    if (!dispositivo) {
      throw ApiError.notFound('Dispositivo no encontrado');
    }
    return dispositivo;
  },

  /**
   * Crea un dispositivo. Valida que el área asociada exista.
   */
  async crear(entrada: CrearDeviceInput): Promise<Device> {
    if (entrada.area_id) {
      await this.verificarArea(entrada.area_id);
    }
    return deviceRepository.crear(entrada);
  },

  /**
   * Actualiza un dispositivo por id. Valida el área si cambia.
   */
  async actualizar(id: string, entrada: ActualizarDeviceInput): Promise<Device> {
    if (entrada.area_id) {
      await this.verificarArea(entrada.area_id);
    }
    const actualizado = await deviceRepository.actualizar(id, entrada);
    if (!actualizado) {
      throw ApiError.notFound('Dispositivo no encontrado');
    }
    return actualizado;
  },

  /**
   * Elimina un dispositivo por id.
   */
  async eliminar(id: string): Promise<void> {
    const eliminado = await deviceRepository.eliminar(id);
    if (!eliminado) {
      throw ApiError.notFound('Dispositivo no encontrado');
    }
  },

  /**
   * Verifica que exista un área con el id dado.
   */
  async verificarArea(areaId: string): Promise<void> {
    const resultado = await query<{ id: string }>(
      'SELECT id FROM areas WHERE id = $1 LIMIT 1',
      [areaId]
    );
    if (resultado.rows.length === 0) {
      throw ApiError.badRequest(`El área con id ${areaId} no existe`);
    }
  },
};
