import { ApiError } from '../../utils/api-error.js';
import type {
  ComandoActuadorConRelaciones,
  ConfirmarComandoInput,
  CrearComandoIntegracionInput,
  CrearComandoWebInput,
} from './comando-actuador.types.js';
import { comandoActuadorRepository } from './comando-actuador.repository.js';
import { actuadorRepository } from '../actuadores/actuador.repository.js';

/**
 * Lógica de negocio de comandos de actuadores.
 *
 * ────────────────────────────────────────────────────────────────────
 * CIRCUITO COMPLETO
 * ────────────────────────────────────────────────────────────────────
 * El camino que recorre una orden, de la web al equipo físico:
 *
 *   1. La WEB guarda el comando           → POST /actuadores/:id/comandos
 *      (estado 'pendiente')
 *
 *   2. NODE-RED pregunta por los pendientes → GET /iot/comandos/pendientes
 *      (autenticado con API Key; permiso `comandos:enviar`)
 *
 *   3. NODE-RED publica en MQTT al tema del actuador
 *      (p. ej. hospital/quirofano/cmd/RELE-1)
 *
 *   4. NODE-RED confirma la entrega        → PATCH /iot/comandos/:id
 *      (estado 'enviado'; y 'ejecutado' si el equipo responde)
 *
 * Antes, el paso 1 guardaba el comando y NADIE lo recogía: se quedaba en
 * 'pendiente' para siempre.
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

  /**
   * Comandos en estado 'pendiente', para que los recoja quien los entrega.
   *
   * Puede llamarlo Node-RED (sin filtro: recoge todo) o un equipo concreto,
   * como un ESP32 con un buzzer, que pregunta SOLO por sus propios comandos
   * indicando su identificador.
   *
   * Solo se devuelven los de actuadores con código: si un comando apunta a un
   * actuador borrado, no hay a quién entregárselo.
   */
  async listarPendientes(
    filtro: { identificador?: string; actuadorCodigo?: string } = {},
    limite = 50
  ): Promise<ComandoActuadorConRelaciones[]> {
    const pendientes = await comandoActuadorRepository.listarPendientes(
      filtro,
      limite
    );
    return pendientes.filter((c) => c.actuador_codigo !== null);
  },

  /**
   * Confirma la entrega o ejecución de un comando (lo llama Node-RED).
   *
   * Es idempotente por diseño: si la integración reintenta la confirmación
   * (por un corte de red), el comando simplemente vuelve a quedar en el mismo
   * estado. No se valida una máquina de estados estricta para no perder
   * confirmaciones legítimas que lleguen fuera de orden.
   *
   * Cuando el estado es 'ejecutado' y se indica `estado_actuador`, se refleja
   * en el actuador: así la web muestra el estado REAL del equipo, no lo que
   * se pidió.
   */
  async confirmar(
    comandoId: string,
    entrada: ConfirmarComandoInput
  ): Promise<ComandoActuadorConRelaciones> {
    const comando = await comandoActuadorRepository.buscarPorId(comandoId);
    if (!comando) {
      throw ApiError.notFound('Comando no encontrado');
    }

    const ahora = new Date();
    await comandoActuadorRepository.actualizarProceso(comandoId, {
      estado: entrada.estado,
      // 'enviado' marca la salida hacia el equipo; 'ejecutado' y 'fallido'
      // implican que ya salió, así que también fijan `enviado_en` si falta.
      enviado_en: comando.enviado_en ?? ahora,
      ejecutado_en: entrada.estado === 'ejecutado' ? ahora : undefined,
      respuesta: entrada.respuesta,
    });

    // Reflejar el estado real en el actuador.
    if (entrada.estado === 'ejecutado' && entrada.estado_actuador) {
      await actuadorRepository.actualizar(comando.actuador_id, {
        estado_actual: entrada.estado_actuador,
      });
    }

    return (await comandoActuadorRepository.buscarPorId(
      comandoId
    )) as ComandoActuadorConRelaciones;
  },

  /** Valida que el actuador exista. */
  async existeActuador(actuadorId: string): Promise<void> {
    const actuador = await actuadorRepository.buscarPorId(actuadorId);
    if (!actuador) {
      throw ApiError.notFound('Actuador no encontrado');
    }
  },
};
