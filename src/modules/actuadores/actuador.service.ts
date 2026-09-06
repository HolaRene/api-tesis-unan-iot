import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ActuadorConRelaciones,
  ActualizarActuadorInput,
  CrearActuadorInput,
} from './actuador.types.js';
import { actuadorRepository } from './actuador.repository.js';

/**
 * Lógica de negocio del módulo de actuadores.
 */
export const actuadorService = {
  /** Lista actuadores con dispositivo y área. */
  async listar(): Promise<ActuadorConRelaciones[]> {
    return actuadorRepository.listar();
  },

  /** Obtiene un actuador por id. */
  async obtenerPorId(id: string): Promise<ActuadorConRelaciones> {
    const actuador = await actuadorRepository.buscarPorId(id);
    if (!actuador) {
      throw ApiError.notFound('Actuador no encontrado');
    }
    return actuador;
  },

  /** Crea un actuador validando dispositivo y unicidad de código. */
  async crear(entrada: CrearActuadorInput): Promise<ActuadorConRelaciones> {
    await this.validarDispositivo(entrada.dispositivo_id);
    await this.validarCodigoUnico(entrada.codigo);
    return actuadorRepository.crear(entrada);
  },

  /** Actualiza un actuador. */
  async actualizar(
    id: string,
    entrada: ActualizarActuadorInput
  ): Promise<ActuadorConRelaciones> {
    if (entrada.dispositivo_id) {
      await this.validarDispositivo(entrada.dispositivo_id);
    }
    const actualizado = await actuadorRepository.actualizar(id, entrada);
    if (!actualizado) {
      throw ApiError.notFound('Actuador no encontrado');
    }
    return actualizado;
  },

  /** Elimina un actuador. */
  async eliminar(id: string): Promise<void> {
    const eliminado = await actuadorRepository.eliminar(id);
    if (!eliminado) {
      throw ApiError.notFound('Actuador no encontrado');
    }
  },

  /** Valida que exista el dispositivo referido. */
  async validarDispositivo(dispositivoId: string): Promise<void> {
    const r = await query<{ id: string }>(
      'SELECT id FROM dispositivos WHERE id = $1 LIMIT 1',
      [dispositivoId]
    );
    if (r.rows.length === 0) {
      throw ApiError.notFound('El dispositivo referido no existe');
    }
  },

  /** Valida que el código no esté en uso. */
  async validarCodigoUnico(codigo: string): Promise<void> {
    const existente = await actuadorRepository.buscarPorCodigo(codigo);
    if (existente) {
      throw ApiError.conflict('Ya existe un actuador con ese código');
    }
  },
};
