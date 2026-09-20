import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarAreaInput,
  Area,
  CrearAreaInput,
} from './area.types.js';
import { areaRepository } from './area.repository.js';
import type { UsuarioAlcance } from '../../utils/alcance.js';

/**
 * Lógica de negocio del módulo de áreas.
 * Orquesta validaciones y delegación al repositorio.
 *
 * AISLAMIENTO: todas las operaciones reciben el usuario autenticado. Un
 * `admin` ve y edita todo; el resto solo lo suyo (más lo global en lectura).
 */
export const areaService = {
  /** Lista las áreas visibles para el usuario. */
  async listar(usuario?: UsuarioAlcance | null): Promise<Area[]> {
    return areaRepository.listar(usuario);
  },

  /**
   * Obtiene un área por id.
   * Si existe pero no es visible para el usuario, responde 404 (no revela
   * que el recurso existe).
   */
  async obtenerPorId(id: string, usuario?: UsuarioAlcance | null): Promise<Area> {
    const area = await areaRepository.buscarPorId(id, usuario);
    if (!area) {
      throw ApiError.notFound('Área no encontrada');
    }
    return area;
  },

  /** Crea un área asignándole como propietario al usuario autenticado. */
  async crear(
    entrada: CrearAreaInput,
    usuario?: UsuarioAlcance | null
  ): Promise<Area> {
    return areaRepository.crear({
      ...entrada,
      // Un admin puede crear recursos globales (sin dueño) si lo pide; el
      // resto siempre crea recursos propios.
      propietario_id: entrada.propietario_id ?? usuario?.id ?? null,
    });
  },

  /** Actualiza un área por id (solo el propietario o un admin). */
  async actualizar(
    id: string,
    entrada: ActualizarAreaInput,
    usuario?: UsuarioAlcance | null
  ): Promise<Area> {
    const actualizada = await areaRepository.actualizar(id, entrada, usuario);
    if (!actualizada) {
      // Puede ser que no exista o que no tenga permiso: se comprueba para
      // responder 403 en lugar de 404 cuando el recurso sí existe.
      const existe = await areaRepository.buscarPorId(id);
      if (existe) {
        throw ApiError.forbidden('No tiene permisos para modificar esta área');
      }
      throw ApiError.notFound('Área no encontrada');
    }
    return actualizada;
  },

  /** Elimina un área por id (solo el propietario o un admin). */
  async eliminar(id: string, usuario?: UsuarioAlcance | null): Promise<void> {
    const eliminada = await areaRepository.eliminar(id, usuario);
    if (!eliminada) {
      const existe = await areaRepository.buscarPorId(id);
      if (existe) {
        throw ApiError.forbidden('No tiene permisos para eliminar esta área');
      }
      throw ApiError.notFound('Área no encontrada');
    }
  },
};
