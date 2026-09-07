import { ApiError } from '../../utils/api-error.js';
import { canalRepository } from './canal.repository.js';
import type {
  FilaCanalDetalle,
  CrearCanalInput,
  ActualizarCanalInput,
  FiltroCanales,
} from './canal.types.js';
import { measurementService } from '../measurements/measurement.service.js';

export const canalService = {
  /** Lista canales (filtros opcionales). */
  async listar(filtro?: FiltroCanales): Promise<FilaCanalDetalle[]> {
    return canalRepository.listar(filtro);
  },

  /** Canal por id (404 si no existe). */
  async obtenerPorId(id: string): Promise<FilaCanalDetalle> {
    const c = await canalRepository.buscarPorId(id);
    if (!c) throw ApiError.notFound('Canal no encontrado');
    return c;
  },

  /**
   * Crea un canal. Valida que el código sea único y que, si se indican,
   * sensor y tipo_variable existan. NO exige sensor (se permite canal
   * independiente provisional para compatibilidad).
   */
  async crear(entrada: CrearCanalInput): Promise<FilaCanalDetalle> {
    const conMismoCodigo = await canalRepository.buscarPorCodigo(entrada.codigo);
    if (conMismoCodigo) throw ApiError.conflict('Ya existe un canal con ese código');
    return canalRepository.crear(entrada);
  },

  async actualizar(id: string, entrada: ActualizarCanalInput): Promise<FilaCanalDetalle> {
    if (entrada.codigo) {
      const existente = await canalRepository.buscarPorCodigo(entrada.codigo);
      if (existente && existente.id !== id)
        throw ApiError.conflict('Ya existe otro canal con ese código');
    }
    const actualizado = await canalRepository.actualizar(id, entrada);
    if (!actualizado) throw ApiError.notFound('Canal no encontrado');
    return actualizado;
  },

  async eliminar(id: string): Promise<void> {
    const ok = await canalRepository.eliminar(id);
    if (!ok) throw ApiError.notFound('Canal no encontrado');
  },

  /** Historial de mediciones de un canal. */
  async historialMediciones(id: string, filtro: { desde?: string; hasta?: string; limite?: number }) {
    await this.obtenerPorId(id); // 404
    return measurementService.listarCanalPorId(id, filtro);
  },
};
