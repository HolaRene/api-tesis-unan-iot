import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarAreaInput,
  Area,
  CrearAreaInput,
} from './area.types.js';
import { areaRepository } from './area.repository.js';

/**
 * Lógica de negocio del módulo de áreas.
 * Orquesta validaciones y delegación al repositorio.
 */
export const areaService = {
  /**
   * Lista todas las áreas.
   */
  async listar(): Promise<Area[]> {
    return areaRepository.listar();
  },

  /**
   * Obtiene un área por id.
   */
  async obtenerPorId(id: string): Promise<Area> {
    const area = await areaRepository.buscarPorId(id);
    if (!area) {
      throw ApiError.notFound('Área no encontrada');
    }
    return area;
  },

  /**
   * Crea un área.
   */
  async crear(entrada: CrearAreaInput): Promise<Area> {
    return areaRepository.crear(entrada);
  },

  /**
   * Actualiza un área por id.
   */
  async actualizar(id: string, entrada: ActualizarAreaInput): Promise<Area> {
    const actualizada = await areaRepository.actualizar(id, entrada);
    if (!actualizada) {
      throw ApiError.notFound('Área no encontrada');
    }
    return actualizada;
  },

  /**
   * Elimina un área por id.
   */
  async eliminar(id: string): Promise<void> {
    const eliminada = await areaRepository.eliminar(id);
    if (!eliminada) {
      throw ApiError.notFound('Área no encontrada');
    }
  },
};
