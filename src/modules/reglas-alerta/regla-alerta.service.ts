import { ApiError } from '../../utils/api-error.js';
import { canalRepository } from '../canales/canal.repository.js';
import { reglaRepository } from './regla-alerta.repository.js';
import { OPERADORES_NUMERIC, OPERADORES_BOOLEAN, OPERADORES_TEXT } from './regla-alerta.schema.js';
import type {
  FilaReglaDetalle,
  CrearReglaInput,
  ActualizarReglaInput,
  FiltroReglas,
} from './regla-alerta.types.js';

export const reglaService = {
  async listar(filtro?: FiltroReglas): Promise<FilaReglaDetalle[]> {
    return reglaRepository.listar(filtro);
  },

  /** Obtiene una regla por id (404 si no existe). */
  async obtenerPorId(id: string): Promise<FilaReglaDetalle> {
    const regla = await reglaRepository.buscarPorId(id);
    if (!regla) throw ApiError.notFound('Regla de alerta no encontrada');
    return regla;
  },

  /** Crea regla validando compatibilidad canal/tipo_dato y operador. */
  async crear(entrada: CrearReglaInput): Promise<FilaReglaDetalle> {
    const canal = await canalRepository.buscarPorId(entrada.canal_id);
    if (!canal) throw ApiError.notFound('El canal no existe');
    const tipoDato = (canal.tipo_dato ?? 'text').toLowerCase();
    this.validarOperador(entrada.operador, tipoDato, canal.codigo);
    const regla = await reglaRepository.crear(entrada);
    return regla as FilaReglaDetalle;
  },

  async actualizar(id: string, entrada: ActualizarReglaInput): Promise<FilaReglaDetalle> {
    if (entrada.canal_id) {
      const canal = await canalRepository.buscarPorId(entrada.canal_id);
      if (!canal) throw ApiError.notFound('El canal no existe');
      if (entrada.operador) {
        this.validarOperador(entrada.operador, (canal.tipo_dato ?? 'text').toLowerCase(), canal.codigo);
      }
    } else if (entrada.operador) {
      const regla = await reglaRepository.buscarPorId(id);
      if (regla) {
        const canal = await canalRepository.buscarPorId(regla.canal_id);
        if (canal) this.validarOperador(entrada.operador, (canal.tipo_dato ?? 'text').toLowerCase(), canal.codigo);
      }
    }
    const regla = await reglaRepository.actualizar(id, entrada);
    if (!regla) throw ApiError.notFound('Regla de alerta no encontrada');
    return regla;
  },

  async eliminar(id: string): Promise<void> {
    const ok = await reglaRepository.eliminar(id);
    if (!ok) throw ApiError.notFound('Regla de alerta no encontrada');
  },

  /** Lanza error de negocio si el operador no es válido para el tipo de dato. */
  validarOperador(operador: string, tipoDato: string, canalCodigo: string): void {
    let permitidos: readonly string[];
    if (tipoDato === 'numeric') {
      permitidos = OPERADORES_NUMERIC as readonly string[];
    } else if (tipoDato === 'boolean') {
      permitidos = OPERADORES_BOOLEAN as readonly string[];
    } else if (tipoDato === 'text') {
      permitidos = OPERADORES_TEXT as readonly string[];
    } else {
      throw ApiError.badRequest(
        `El canal '${canalCodigo}' (tipo ${tipoDato}) no soporta reglas genéricas`
      );
    }
    if (!(permitidos as readonly string[]).includes(operador)) {
      throw ApiError.badRequest(
        `El operador '${operador}' no es válido para un canal ${tipoDato}. Permitidos: ${permitidos.join(', ')}`
      );
    }
  },
};
