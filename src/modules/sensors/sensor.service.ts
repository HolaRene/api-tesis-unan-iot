import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarSensorInput,
  CrearSensorInput,
  SensorConNombres,
} from './sensor.types.js';
import { sensorRepository } from './sensor.repository.js';

/**
 * Lógica de negocio del módulo de sensores.
 */
export const sensorService = {
  /**
   * Lista todos los sensores.
   */
  async listar(): Promise<SensorConNombres[]> {
    return sensorRepository.listar();
  },

  /**
   * Obtiene un sensor por id.
   */
  async obtenerPorId(id: string): Promise<SensorConNombres> {
    const sensor = await sensorRepository.buscarPorId(id);
    if (!sensor) {
      throw ApiError.notFound('Sensor no encontrado');
    }
    return sensor;
  },

  /**
   * Crea un sensor. Valida referencias y unicidad del código.
   */
  async crear(entrada: CrearSensorInput): Promise<SensorConNombres> {
    await this.validarExistencias(entrada.dispositivo_id, entrada.tipo_variable_id);

    const existente = await sensorRepository.buscarPorCodigo(entrada.codigo);
    if (existente) {
      throw ApiError.conflict('Ya existe un sensor con ese código');
    }
    return sensorRepository.crear(entrada);
  },

  /**
   * Actualiza un sensor por id.
   */
  async actualizar(id: string, entrada: ActualizarSensorInput): Promise<SensorConNombres> {
    if (entrada.codigo !== undefined) {
      const existente = await sensorRepository.buscarPorCodigo(entrada.codigo);
      if (existente && existente.id !== id) {
        throw ApiError.conflict('Ya existe otro sensor con ese código');
      }
    }

    await this.validarExistencias(entrada.dispositivo_id, entrada.tipo_variable_id);

    const actualizado = await sensorRepository.actualizar(id, entrada);
    if (!actualizado) {
      throw ApiError.notFound('Sensor no encontrado');
    }
    return actualizado;
  },

  /**
   * Elimina un sensor por id.
   */
  async eliminar(id: string): Promise<void> {
    const eliminado = await sensorRepository.eliminar(id);
    if (!eliminado) {
      throw ApiError.notFound('Sensor no encontrado');
    }
  },

  /**
   * Valida que el dispositivo y el tipo de variable existan.
   */
  async validarExistencias(dispositivoId?: string | null, tipoVariableId?: string | null): Promise<void> {
    if (dispositivoId) {
      const dispositivo = await query<{ id: string }>(
        'SELECT id FROM dispositivos WHERE id = $1 LIMIT 1',
        [dispositivoId]
      );
      if (dispositivo.rows.length === 0) {
        throw ApiError.badRequest(`El dispositivo con id ${dispositivoId} no existe`);
      }
    }
    if (tipoVariableId) {
      const tipo = await query<{ id: string }>(
        'SELECT id FROM tipos_variable WHERE id = $1 LIMIT 1',
        [tipoVariableId]
      );
      if (tipo.rows.length === 0) {
        throw ApiError.badRequest(`El tipo de variable con id ${tipoVariableId} no existe`);
      }
    }
  },
};
