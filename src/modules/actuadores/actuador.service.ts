import { query } from '../../database/pool.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  ActuadorConRelaciones,
  ActualizarActuadorInput,
  CrearActuadorInput,
} from './actuador.types.js';
import { actuadorRepository } from './actuador.repository.js';
import { codigoDeActuador } from '../../utils/identificadores.js';
import { validarDireccionamiento } from './direccionamiento.js';

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
   *
   * Además se exige que el DIRECCIONAMIENTO esté completo para su protocolo:
   * un actuador sin dirección no se puede accionar, porque el comando
   * llegaría al equipo sin decirle dónde escribir.
   */
  async crear(entrada: CrearActuadorInput): Promise<ActuadorConRelaciones> {
    await this.validarDispositivo(entrada.dispositivo_id);

    const protocolo = entrada.protocolo ?? 'mqtt';
    this.validarProtocolo(protocolo, entrada.configuracion);

    const base = codigoDeActuador(entrada.nombre, entrada.tipo);
    const codigo = await this.codigoDisponible(base);

    return actuadorRepository.crear({
      ...entrada,
      codigo,
      protocolo,
      // MQTT sin configuración explícita es válido: el tema se deriva del
      // código. Se guarda como objeto vacío para no dejar NULL.
      configuracion: entrada.configuracion ?? {},
    });
  },

  /**
   * Comprueba que el direccionamiento sea válido para el protocolo.
   *
   * Se hace aquí y no en el esquema de Zod porque depende del valor de
   * `protocolo`: Zod validaría cada campo por separado, sin poder exigir que
   * Modbus traiga dirección y GPIO traiga pin.
   *
   * @throws ApiError.badRequest con la lista de problemas concretos.
   */
  validarProtocolo(
    protocolo: string,
    configuracion: Record<string, unknown> | null | undefined
  ): void {
    const problemas = validarDireccionamiento(protocolo, configuracion);
    if (problemas.length > 0) {
      throw ApiError.badRequest(
        `Direccionamiento incompleto: ${problemas.join('; ')}`
      );
    }
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

    /*
     * Si cambia el protocolo o el direccionamiento, se valida la combinacion
     * RESULTANTE, no solo lo que llega: cambiar el protocolo a modbus sin
     * enviar direccion dejaria el actuador inaccesible.
     */
    if (datos.protocolo !== undefined || datos.configuracion !== undefined) {
      const actual = await this.obtenerPorId(id);
      const protocolo = datos.protocolo ?? actual.protocolo ?? 'mqtt';
      const configuracion =
        datos.configuracion !== undefined
          ? datos.configuracion
          : actual.configuracion;
      this.validarProtocolo(protocolo, configuracion);
    }

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
