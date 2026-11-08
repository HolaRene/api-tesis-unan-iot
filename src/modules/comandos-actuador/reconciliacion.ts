/**
 * Reconciliación de comandos por estado reportado.
 *
 * ──────────────────────────────────────────────────────────────────────
 * EL PROBLEMA
 * ──────────────────────────────────────────────────────────────────────
 * Node-RED escribe en el PLC, espera el timeout y, si no ve el cambio, marca
 * el comando como `fallido`. Pero el equipo puede tardar MÁS que el timeout:
 * la orden sí se aplicó, solo que despacio.
 *
 * Sin reconciliar, ese comando queda `fallido` para siempre aunque el
 * actuador esté exactamente en el estado pedido. En la tesis eso se leería
 * como un fallo del sistema cuando fue una confirmación tardía.
 *
 * ──────────────────────────────────────────────────────────────────────
 * QUÉ HACE
 * ──────────────────────────────────────────────────────────────────────
 * Cuando el actuador reporta su estado real, se buscan comandos recientes
 * que quedaran `fallido` o `enviado`. Si alguno pedía ESE estado, se marca
 * `ejecutado`.
 *
 * Conserva el error original dentro de `respuesta`, y añade:
 *
 *   respuesta.advertencia      = "escritura reportó error: ..."   (si lo hubo)
 *   respuesta.confirmado_por   = "estado_reportado"
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUÉ «CONFIRMACIÓN INDIRECTA»
 * ──────────────────────────────────────────────────────────────────────
 * No se leyó la salida justo después de escribir, como en una confirmación
 * normal. Se deduce del estado que el equipo reporta más tarde. Es más débil:
 * pudo cambiar por otra causa entre medias.
 *
 * Por eso se marca explícitamente con `confirmado_por: "estado_reportado"`.
 * En la tesis debe presentarse como confirmación indirecta, no como una
 * lectura de vuelta del propio comando.
 */

/**
 * Ventana por defecto para reconciliar, en minutos.
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUÉ 2 Y NO 10
 * ──────────────────────────────────────────────────────────────────────
 * Con una ventana larga, un `ON` fallido de hace 9 minutos se daría por
 * bueno porque alguien encendió el equipo a mano entretanto. Eso no es una
 * confirmación: es una coincidencia.
 *
 * Dos minutos cubren de sobra una confirmación tardía (el timeout típico de
 * Modbus es de 5 s y la lectura extra, de 10 s), sin alcanzar a cambios
 * ajenos al comando.
 */
export const VENTANA_RECONCILIACION_MIN = 2;

/** Comando pendiente de reconciliar, tal como lo devuelve el repositorio. */
export interface ComandoReconciliable {
  id: string;
  actuador_id: string;
  comando: string;
  estado: string;
  respuesta: Record<string, unknown> | null;
  metadatos: Record<string, unknown> | null;
}

/**
 * ¿El comando pedía este estado de actuador?
 *
 * Se aceptan las formas habituales de nombrar lo mismo: el comando guardado
 * (`ON`, `1`, `true`) y el estado reportado (`on`, `encendido`).
 */
export function comandoPediaEstado(
  comando: string,
  estadoReportado: string
): boolean {
  const pedido = comando.trim().toUpperCase();
  const reportado = estadoReportado.trim().toLowerCase();

  const comoEncendido = ['ON', '1', 'TRUE', 'ENCENDER', 'ABRIR'];
  const comoApagado = ['OFF', '0', 'FALSE', 'APAGAR', 'CERRAR'];

  const estadosEncendido = ['on', 'encendido', 'abierto', 'abierta', 'activo', 'true', '1'];
  const estadosApagado = ['off', 'apagado', 'cerrado', 'cerrada', 'inactivo', 'false', '0'];

  if (comoEncendido.includes(pedido)) return estadosEncendido.includes(reportado);
  if (comoApagado.includes(pedido)) return estadosApagado.includes(reportado);

  // Comandos con valor propio (p. ej. 'SETPOINT'): comparación directa.
  return pedido.toLowerCase() === reportado;
}

/**
 * Construye la `respuesta` final del comando reconciliado.
 *
 * Se conserva TODO lo que había (incluido el error original) y se añade el
 * motivo de la reconciliación. Ocultar el error sería falsear el registro.
 */
export function respuestaReconciliada(
  comando: ComandoReconciliable,
  estadoReportado: string,
  ahora: Date
): Record<string, unknown> {
  const previa = comando.respuesta ?? {};

  return {
    ...previa,
    confirmado_por: 'estado_reportado',
    estado_reportado: estadoReportado,
    reconciliado_en: ahora.toISOString(),
    /*
     * El motivo original se conserva aparte porque `motivo` puede
     * sobrescribirse al reinterpretar el comando.
     */
    motivo_original: previa.motivo ?? null,
    motivo: 'confirmado_por_estado_reportado',
  };
}

/**
 * Elige el comando que debe reconciliarse con un estado reportado.
 *
 * ──────────────────────────────────────────────────────────────────────
 * SOLO UNO: EL MÁS RECIENTE
 * ──────────────────────────────────────────────────────────────────────
 * Si hubo tres `ON` fallidos, el equipo encendido explica como mucho el
 * ÚLTIMO: los dos anteriores ya pudieron quedar sin efecto. Marcarlos todos
 * como ejecutados sería inventar un historial que no ocurrió.
 *
 * Devuelve `null` si ninguno encaja.
 *
 * ──────────────────────────────────────────────────────────────────────
 * QUÉ NO RECONCILIA
 * ──────────────────────────────────────────────────────────────────────
 *   - `ejecutado`: ya está cerrado.
 *   - `pendiente`: aún no se ha escrito; sería adelantarse al envío.
 *   - Estado distinto del pedido.
 *
 * La ventana temporal (por defecto 2 minutos) la aplica la consulta, no
 * esta función: así se descarta en SQL y no se traen filas inútiles.
 */
export function seleccionarReconciliable(
  comandos: ComandoReconciliable[],
  estadoReportado: string
): ComandoReconciliable | null {
  /*
   * `comandos` llega ordenado de más reciente a más antiguo (lo hace la
   * consulta con ORDER BY creado_en DESC). Se toma el primero que encaje.
   */
  return (
    comandos.find(
      (c) =>
        (c.estado === 'fallido' || c.estado === 'enviado') &&
        comandoPediaEstado(c.comando, estadoReportado)
    ) ?? null
  );
}
