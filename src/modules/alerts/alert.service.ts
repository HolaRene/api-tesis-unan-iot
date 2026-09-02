import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarAlertInput,
  Alert,
  CrearAlertInput,
} from './alert.types.js';
import { alertRepository } from './alert.repository.js';

/**
 * Lógica de negocio del módulo de alertas.
 */
export const alertService = {
  /**
   * Lista todas las alertas.
   */
  async listar(): Promise<Alert[]> {
    return alertRepository.listar();
  },

  /**
   * Obtiene una alerta por id.
   */
  async obtenerPorId(id: string): Promise<Alert> {
    const alerta = await alertRepository.buscarPorId(id);
    if (!alerta) {
      throw ApiError.notFound('Alerta no encontrada');
    }
    return alerta;
  },

  /**
   * Crea una alerta. Valida sensor y medición si se proporcionan.
   */
  async crear(entrada: CrearAlertInput): Promise<Alert> {
    await this.validarExistencias(entrada.sensor_id, entrada.medicion_id);
    return alertRepository.crear(entrada);
  },

  /**
   * Actualiza una alerta por id.
   */
  async actualizar(id: string, entrada: ActualizarAlertInput): Promise<Alert> {
    await this.validarExistencias(entrada.sensor_id, entrada.medicion_id);
    const actualizada = await alertRepository.actualizar(id, entrada);
    if (!actualizada) {
      throw ApiError.notFound('Alerta no encontrada');
    }
    return actualizada;
  },

  /**
   * Elimina una alerta por id.
   */
  async eliminar(id: string): Promise<void> {
    const eliminada = await alertRepository.eliminar(id);
    if (!eliminada) {
      throw ApiError.notFound('Alerta no encontrada');
    }
  },

  /**
   * Valida que el sensor y la medición referenciados existan.
   */
  async validarExistencias(sensorId?: string | null, medicionId?: number | null): Promise<void> {
    if (sensorId) {
      const sensor = await query<{ id: string }>(
        'SELECT id FROM sensores WHERE id = $1 LIMIT 1',
        [sensorId]
      );
      if (sensor.rows.length === 0) {
        throw ApiError.badRequest(`El sensor con id ${sensorId} no existe`);
      }
    }
    if (medicionId) {
      const medicion = await query<{ id: number }>(
        'SELECT id FROM mediciones WHERE id = $1 LIMIT 1',
        [medicionId]
      );
      if (medicion.rows.length === 0) {
        throw ApiError.badRequest(`La medición con id ${medicionId} no existe`);
      }
    }
  },
};
