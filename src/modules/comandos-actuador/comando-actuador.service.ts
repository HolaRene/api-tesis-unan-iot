import { ApiError } from '../../utils/api-error.js';
import type {
  ComandoActuadorConRelaciones,
  CrearComandoIntegracionInput,
  CrearComandoWebInput,
} from './comando-actuador.types.js';
import { comandoActuadorRepository } from './comando-actuador.repository.js';
import { actuadorRepository } from '../actuadores/actuador.repository.js';

/**
 * Lógica de negocio de comandos de actuadores.
 *
 * - Origen WEB: registra `usuario_id`.
 * - Origen INTEGRACIÓN (API Key): registra `clave_api_id` y resuelve el
 *   actuador por código. La entrega física al ESP32 se resuelve en una capa
 *   posterior (por ejemplo, Node-RED consulta/recibe el comando pendiente).
 */
export const comandoActuadorService = {
  /**
   * Registra un comando desde la web (usuario autenticado por JWT).
   */
  async crearDesdeWeb(entrada: CrearComandoWebInput): Promise<ComandoActuadorConRelaciones> {
    await this.existeActuador(entrada.actuador_id);
    return comandoActuadorRepository.crear({
      actuador_id: entrada.actuador_id,
      usuario_id: entrada.usuario_id,
      comando: entrada.comando,
      valor: entrada.valor,
      metadatos: entrada.metadatos,
    });
  },

  /**
   * Registra un comando enviado por una integración con API Key.
   * El actuador se resuelve por código lógico.
   */
  async crearDesdeIntegracion(
    entrada: CrearComandoIntegracionInput
  ): Promise<ComandoActuadorConRelaciones> {
    const actuador = await actuadorRepository.buscarPorCodigo(entrada.actuadorCodigo);
    if (!actuador) {
      throw ApiError.notFound('Actuador no encontrado por código');
    }
    if (!actuador.activo) {
      throw ApiError.badRequest('El actuador está desactivado');
    }

    return comandoActuadorRepository.crear({
      actuador_id: actuador.id,
      clave_api_id: entrada.clave_api_id,
      comando: entrada.comando,
      valor: entrada.valor,
      metadatos: entrada.metadatos,
    });
  },

  /** Consulta los últimos comandos de un actuador. */
  async listarPorActuador(actuadorId: string, limite = 50) {
    await this.existeActuador(actuadorId);
    return comandoActuadorRepository.listarPorActuador(actuadorId, limite);
  },

  /** Valida que el actuador exista. */
  async existeActuador(actuadorId: string): Promise<void> {
    const actuador = await actuadorRepository.buscarPorId(actuadorId);
    if (!actuador) {
      throw ApiError.notFound('Actuador no encontrado');
    }
  },
};
