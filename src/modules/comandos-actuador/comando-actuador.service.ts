import { ApiError } from '../../utils/api-error.js';
import type {
  ComandoActuadorConRelaciones,
  ConfirmarComandoInput,
  CrearComandoIntegracionInput,
  CrearComandoWebInput,
} from './comando-actuador.types.js';
import { comandoActuadorRepository } from './comando-actuador.repository.js';
import type { UsuarioAlcance } from '../../utils/alcance.js';
import {
  emitirComandoActualizado,
  emitirActuadorActualizado,
} from '../../realtime/actuadores.eventos.js';
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
  async crearDesdeWeb(
    entrada: CrearComandoWebInput,
    usuario?: UsuarioAlcance | null
  ): Promise<ComandoActuadorConRelaciones> {
    /*
     * `usuario` es imprescindible aquí: sin él, cualquiera con sesión podía
     * enviar órdenes a actuadores de OTRO usuario conociendo su id.
     */
    const actuador = await this.existeActuador(entrada.actuador_id, usuario);

    /*
     * Un actuador desactivado no debe recibir órdenes.
     *
     * La integración (API Key) ya lo comprobaba, pero la web no: se podía
     * encolar un comando para un equipo fuera de servicio. Node-RED lo
     * ejecutaría igualmente, porque solo mira los pendientes.
     */
    if (!actuador.activo) {
      throw ApiError.badRequest(
        'El actuador está desactivado; no admite comandos.'
      );
    }
    const comando = await comandoActuadorRepository.crear({
      actuador_id: entrada.actuador_id,
      usuario_id: entrada.usuario_id,
      comando: entrada.comando,
      valor: entrada.valor,
      metadatos: entrada.metadatos,
    });

    /*
     * Se avisa en cuanto queda encolado: así el botón del dashboard puede
     * mostrar «enviando…» de inmediato, sin esperar al refresco.
     * Va después del COMMIT del INSERT.
     */
    emitirComandoActualizado(comando);

    return comando;
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

    const comando = await comandoActuadorRepository.crear({
      actuador_id: actuador.id,
      clave_api_id: entrada.clave_api_id,
      comando: entrada.comando,
      valor: entrada.valor,
      metadatos: entrada.metadatos,
    });
    emitirComandoActualizado(comando);
    return comando;
  },

  /** Consulta los últimos comandos de un actuador. */
  async listarPorActuador(
    actuadorId: string,
    limite = 50,
    usuario?: UsuarioAlcance | null
  ) {
    await this.existeActuador(actuadorId, usuario);
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

    /*
     * Marcas de tiempo de Node-RED.
     *
     * Se aceptan tal cual llegaron (UTC) en lugar de sustituirlas por `ahora`:
     * `enviado_en` es el instante en que se ESCRIBIÓ en el PLC, y sustituirlo
     * por el de la confirmación borraría justo el dato que se quiere medir
     * (el retardo real del equipo).
     *
     * Si no llegan, se mantiene el comportamiento anterior.
     */
    const fecha = (v?: string) => (v ? new Date(v) : undefined);

    await comandoActuadorRepository.actualizarProceso(comandoId, {
      estado: entrada.estado,
      recogido_en: fecha(entrada.recogido_en),
      // 'enviado' marca la salida hacia el equipo; 'ejecutado' y 'fallido'
      // implican que ya salió, así que también fijan `enviado_en` si falta.
      enviado_en: fecha(entrada.enviado_en) ?? comando.enviado_en ?? ahora,
      confirmado_en: fecha(entrada.confirmado_en),
      ejecutado_en: entrada.estado === 'ejecutado' ? ahora : undefined,
      respuesta: entrada.respuesta,
    });

    // Reflejar el estado real en el actuador.
    let actuadorActualizado = false;
    if (entrada.estado === 'ejecutado' && entrada.estado_actuador) {
      await actuadorRepository.actualizar(comando.actuador_id, {
        estado_actual: entrada.estado_actuador,
        ultima_orden_en: ahora,
      });
      actuadorActualizado = true;
    }

    const confirmado = (await comandoActuadorRepository.buscarPorId(
      comandoId
    )) as ComandoActuadorConRelaciones;

    /*
     * EVENTOS (después del COMMIT).
     *
     * `comando:actualizado` en cada estado, no solo al terminar: la web
     * necesita ver el paso «enviado» para que el usuario sepa que su orden
     * ya salió del servidor.
     *
     * `actuador:actualizado` solo cuando cambió el estado del equipo: es lo
     * que hace que la tarjeta del dashboard se repinte sola.
     */
    emitirComandoActualizado(confirmado);

    if (actuadorActualizado) {
      const actuador = await actuadorRepository.buscarPorId(comando.actuador_id);
      if (actuador) {
        emitirActuadorActualizado({
          id: actuador.id,
          codigo: actuador.codigo,
          nombre: actuador.nombre,
          estado_actual: actuador.estado_actual ?? null,
          ultima_orden_en: actuador.ultima_orden_en ?? ahora,
        });
      }
    }

    return confirmado;
  },

  /**
   * Valida que el actuador exista Y sea visible para el usuario.
   *
   * Devuelve el actuador para que quien llama pueda comprobar además si
   * está activo, sin repetir la consulta.
   */
  async existeActuador(
    actuadorId: string,
    usuario?: UsuarioAlcance | null
  ) {
    const actuador = await actuadorRepository.buscarPorId(actuadorId, usuario);
    if (!actuador) {
      throw ApiError.notFound('Actuador no encontrado');
    }
    return actuador;
  },

  /**
   * Descarta los comandos que nadie recogió a tiempo.
   *
   * Lo llama el trabajo periódico (`jobs/comando-expiracion.ts`). No se
   * expone por HTTP: no es una acción de usuario.
   *
   * @param minutos Antigüedad a partir de la cual un comando caduca.
   * @returns Cuántos comandos se marcaron como expirados.
   */
  async expirarPendientes(minutos: number): Promise<number> {
    if (minutos <= 0) return 0;

    const { filas, total } = await comandoActuadorRepository.expirarPendientes(
      minutos
    );

    /*
     * Se avisa de cada comando caducado. Sin esto, la tarjeta del dashboard
     * se quedaba en «encolado, esperando al equipo…» indefinidamente,
     * aunque el comando ya no se fuera a ejecutar nunca.
     */
    for (const fila of filas) {
      emitirComandoActualizado(fila);
    }

    return total;
  },

  /** Configuración de latencia/timeout por actuador (para Node-RED). */
  async configuracionSimulacion(identificador?: string) {
    return comandoActuadorRepository.configuracionSimulacion(identificador);
  },
};
