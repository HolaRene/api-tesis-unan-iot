import { ApiError } from '../../utils/api-error.js';
import type {
  ActualizarVariableTypeInput,
  CrearVariableTypeInput,
  VariableType,
} from './variable-type.types.js';
import { variableTypeRepository } from './variable-type.repository.js';

/**
 * Lógica de negocio del módulo de tipos de variable.
 */
export const variableTypeService = {
  /**
   * Lista todos los tipos de variable.
   */
  async listar(): Promise<VariableType[]> {
    return variableTypeRepository.listar();
  },

  /**
   * Obtiene un tipo de variable por id.
   */
  async obtenerPorId(id: string): Promise<VariableType> {
    const tipo = await variableTypeRepository.buscarPorId(id);
    if (!tipo) {
      throw ApiError.notFound('Tipo de variable no encontrado');
    }
    return tipo;
  },

  /**
   * Crea un tipo de variable. Valida que el código no exista.
   */
  async crear(entrada: CrearVariableTypeInput): Promise<VariableType> {
    const existente = await variableTypeRepository.buscarPorCodigo(entrada.codigo);
    if (existente) {
      throw ApiError.conflict('Ya existe un tipo de variable con ese código');
    }
    return variableTypeRepository.crear(entrada);
  },

  /**
   * Actualiza un tipo de variable por id. Valida unicidad del código.
   */
  async actualizar(id: string, entrada: ActualizarVariableTypeInput): Promise<VariableType> {
    if (entrada.codigo !== undefined) {
      const existente = await variableTypeRepository.buscarPorCodigo(entrada.codigo);
      if (existente && existente.id !== id) {
        throw ApiError.conflict('Ya existe otro tipo de variable con ese código');
      }
    }
    const actualizado = await variableTypeRepository.actualizar(id, entrada);
    if (!actualizado) {
      throw ApiError.notFound('Tipo de variable no encontrado');
    }
    return actualizado;
  },

  /**
   * Elimina un tipo de variable por id.
   */
  async eliminar(id: string): Promise<void> {
    const eliminado = await variableTypeRepository.eliminar(id);
    if (!eliminado) {
      throw ApiError.notFound('Tipo de variable no encontrado');
    }
  },
};
