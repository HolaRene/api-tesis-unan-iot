import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarThresholdInput,
  CrearThresholdInput,
  Threshold,
} from './threshold.types.js';
import { thresholdRepository } from './threshold.repository.js';

/**
 * Lógica de negocio del módulo de umbrales.
 */
export const thresholdService = {
  /**
   * Lista todos los umbrales.
   */
  async listar(): Promise<Threshold[]> {
    return thresholdRepository.listar();
  },

  /**
   * Obtiene un umbral por id.
   */
  async obtenerPorId(id: string): Promise<Threshold> {
    const umbral = await thresholdRepository.buscarPorId(id);
    if (!umbral) {
      throw ApiError.notFound('Umbral no encontrado');
    }
    return umbral;
  },

  /**
   * Crea un umbral. Valida que el sensor exista.
   */
  async crear(entrada: CrearThresholdInput): Promise<Threshold> {
    if (entrada.sensor_id) {
      await this.verificarSensor(entrada.sensor_id);
    }
    return thresholdRepository.crear(entrada);
  },

  /**
   * Actualiza un umbral por id.
   */
  async actualizar(id: string, entrada: ActualizarThresholdInput): Promise<Threshold> {
    if (entrada.sensor_id) {
      await this.verificarSensor(entrada.sensor_id);
    }
    const actualizado = await thresholdRepository.actualizar(id, entrada);
    if (!actualizado) {
      throw ApiError.notFound('Umbral no encontrado');
    }
    return actualizado;
  },

  /**
   * Elimina un umbral por id.
   */
  async eliminar(id: string): Promise<void> {
    const eliminado = await thresholdRepository.eliminar(id);
    if (!eliminado) {
      throw ApiError.notFound('Umbral no encontrado');
    }
  },

  /**
   * Verifica que exista un sensor con el id dado.
   */
  async verificarSensor(sensorId: string): Promise<void> {
    const resultado = await query<{ id: string }>(
      'SELECT id FROM sensores WHERE id = $1 LIMIT 1',
      [sensorId]
    );
    if (resultado.rows.length === 0) {
      throw ApiError.badRequest(`El sensor con id ${sensorId} no existe`);
    }
  },
};
