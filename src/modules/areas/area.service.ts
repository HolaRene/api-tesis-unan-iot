import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarAreaInput,
  Area,
  CrearAreaInput,
} from './area.types.js';
import { areaRepository } from './area.repository.js';
import type { UsuarioAlcance } from '../../utils/alcance.js';
import { calcularCumplimiento } from './cumplimiento.js';
import { listarPlantillas } from '../plantillas-alerta/plantilla-alerta.service.js';

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

  /**
   * Cumplimiento normativo del área.
   *
   * Devuelve, por cada magnitud presente, el último valor medido frente a la
   * banda que fija el perfil del área. Si el área no declara perfil, se
   * devuelve igualmente con estado `sin_regla` para que la interfaz pueda
   * ofrecer asignarlo.
   */
  async cumplimiento(id: string, usuario?: UsuarioAlcance | null) {
    const area = await this.obtenerPorId(id, usuario);

    const plantillaId = area.perfil_alerta ?? null;
    let plantilla = null;
    if (plantillaId) {
      const plantillas = await listarPlantillas();
      plantilla = plantillas.find((p) => p.id === plantillaId) ?? null;
    }

    const magnitudes = await areaRepository.ultimosValoresPorMagnitud(id);
    const ultimos = new Map(
      magnitudes.map((m) => [
        m.codigo.toUpperCase(),
        { valor: m.valor, medido_en: m.medido_en },
      ])
    );

    const comprometidas = calcularCumplimiento(
      plantilla,
      magnitudes.map((m) => ({
        codigo: m.codigo,
        nombre: m.nombre,
        unidad: m.unidad,
      })),
      ultimos
    );

    return {
      area: { id: area.id, nombre: area.nombre, perfil_alerta: plantillaId },
      perfil: plantilla
        ? {
            id: plantilla.id,
            nombre: plantilla.nombre,
            norma: plantilla.norma,
            notas: plantilla.notas,
          }
        : null,
      magnitudes: comprometidas,
      resumen: {
        total: comprometidas.length,
        cumple: comprometidas.filter((m) => m.estado === 'cumple').length,
        fuera: comprometidas.filter((m) => m.estado === 'fuera').length,
        bueno: comprometidas.filter((m) => m.nivel === 'bueno').length,
        advertencia: comprometidas.filter((m) => m.nivel === 'advertencia').length,
        critico: comprometidas.filter((m) => m.nivel === 'critico').length,
        sin_datos: comprometidas.filter((m) => m.estado === 'sin_datos').length,
        sin_regla: comprometidas.filter((m) => m.estado === 'sin_regla').length,
      },
    };
  },
};
