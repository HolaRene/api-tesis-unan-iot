import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ActuadorConRelaciones,
  ActualizarActuadorInput,
  CrearActuadorInput,
} from './actuador.types.js';
import { actuadorRepository } from './actuador.repository.js';
import { codigoDeActuador } from '../../utils/identificadores.js';

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

  /**
   * Crea un actuador validando el dispositivo y GENERANDO el código.
   *
   * EL CÓDIGO LO GENERA EL SERVIDOR, no el cliente.
   *
   * Es una clave UNIQUE en toda la base de datos y forma parte del TEMA MQTT
   * al que Node-RED publica las órdenes:
   *
   *     hospital/quirofano/cmd/BUZZER-QUIROFANO
   *
   * Se deriva del TIPO y el NOMBRE. Si el cliente envía un `codigo`, se
   * IGNORA en silencio, para no romper versiones antiguas del frontend.
   */
  async crear(entrada: CrearActuadorInput): Promise<ActuadorConRelaciones> {
    await this.validarDispositivo(entrada.dispositivo_id);

    const base = codigoDeActuador(entrada.nombre, entrada.tipo);
    const codigo = await this.codigoDisponible(base);

    return actuadorRepository.crear({ ...entrada, codigo });
  },

  /**
   * Devuelve un código libre, añadiendo sufijo numérico si hace falta.
   *
   *   "BUZZER-QUIROFANO"    → "BUZZER-QUIROFANO"
   *   (otra vez)            → "BUZZER-QUIROFANO-2"
   */
  async codigoDisponible(base: string): Promise<string> {
    let candidato = base;
    let intento = 1;
    while (await actuadorRepository.buscarPorCodigo(candidato)) {
      intento += 1;
      candidato = `${base}-${intento}`;
    }
    return candidato;
  },

  /**
   * Actualiza un actuador.
   *
   * El CÓDIGO no se puede cambiar: forma parte del tema MQTT que Node-RED ya
   * está usando para publicar órdenes. Si se modificara, los comandos
   * seguirían saliendo al tema antiguo y el equipo dejaría de responder.
   *
   * Si el cliente lo envía, se descarta sin error.
   */
  async actualizar(
    id: string,
    entrada: ActualizarActuadorInput
  ): Promise<ActuadorConRelaciones> {
    if (entrada.dispositivo_id) {
      await this.validarDispositivo(entrada.dispositivo_id);
    }

    const { codigo: _ignorado, ...datos } = entrada;

    const actualizado = await actuadorRepository.actualizar(id, datos);
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
};
