/**
 * Motor de evaluación de reglas de alerta.
 *
 * Funciones PURAS: dado un valor y una regla, deciden el estado. Sin base de
 * datos, sin HTTP y sin relojes ocultos — el instante se pasa como parámetro.
 * Así se pueden probar los casos límite sin levantar nada.
 *
 * ────────────────────────────────────────────────────────────────────
 * LAS TRES IDEAS QUE IMPLEMENTA (ISA-18.2 / IEC 62682)
 * ────────────────────────────────────────────────────────────────────
 *
 * 1. RETARDO — una condición debe mantenerse N segundos antes de alarmar.
 *
 *    Sin esto, un pico de un segundo genera una alarma que alguien tiene
 *    que atender. Con retardo de 60 s, el pico se ignora y solo alarma lo
 *    que persiste.
 *
 * 2. HISTÉRESIS — el umbral para CERRAR es distinto del de ABRIR.
 *
 *    Sin esto, un valor oscilando en el borde (23,98 / 24,02 / 23,99…) abre
 *    y cierra la alerta en cada medición: decenas de avisos por minuto.
 *    Con histéresis 0,5, la banda 20–24 cierra solo al entrar en 20,5–23,5.
 *
 * 3. ESTADOS — active → acknowledged → resolved.
 *
 *    Una alerta abierta se puede reconocer (alguien la está viendo) sin que
 *    eso la cierre. Solo se resuelve cuando la condición deja de cumplirse.
 */


/**
 * Convierte a número SIN romper con los valores que llegan de PostgreSQL.
 *
 * Las columnas `NUMERIC` de PostgreSQL llegan al driver `pg` como STRING
 * ("20", "0.5000"), no como number. Sin esta conversión, `"20" + 0.5`
 * concatena y da `"200.5"`: la banda de cierre se vuelve enorme y la
 * alerta no se cierra nunca.
 *
 * Devolver `null` (y no 0) cuando no hay valor es importante: `0` es un
 * umbral válido (presión ≤ 0 Pa, temperatura 0 °C).
 */
function aNumero(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Regla mínima que necesita el motor. */
export interface ReglaEvaluable {
  operador: string;
  valor_referencia_numerico?: number | string | null;
  valor_min?: number | string | null;
  valor_max?: number | string | null;
  valor_referencia_texto?: string | null;
  /**
   * Segundos que la condición debe mantenerse cumpliéndose antes de abrir
   * la alerta. `null` o `0` = abre de inmediato.
   */
  retardo_segundos?: number | null;
  /**
   * Margen para cerrar. Solo aplica a reglas numéricas de banda
   * (`entre`, `fuera_de_rango`) y a comparaciones simple (`>`, `<`…).
   */
  histeresis?: number | string | null;
}

/** Lo que hay que saber de la alerta abierta, si existe. */
export interface AlertaAbierta {
  /** Estado actual: `active` o `acknowledged`. */
  estado: string;
  /** Cuándo empezó a cumplirse la condición por primera vez. */
  iniciada_en: Date;
}

export type DecisionEvaluacion =
  /** Abrir una alerta nueva. */
  | { accion: 'abrir' }
  /** No hacer nada: la condición sigue cumpliéndose pero el retardo no venció. */
  | { accion: 'esperar'; segundosTranscurridos: number }
  /** Cerrar las alertas abiertas de esta regla. */
  | { accion: 'resolver' }
  /** No hacer nada: el valor está en la zona muerta de la histéresis. */
  | { accion: 'mantener'; motivo: 'histeresis' }
  /** No hacer nada: fuera de la banda y sin alerta previa. */
  | { accion: 'nada' };

/**
 * ¿El valor cumple la condición de la regla?
 *
 * Ojo con `entre`: avisa cuando el valor ESTÁ dentro. Para expresar una
 * banda aceptable («debe estar entre 20 y 24») hay que usar
 * `fuera_de_rango`, no `entre`.
 */
export function cumpleCondicion(
  regla: ReglaEvaluable,
  valor: number | string | null | undefined
): boolean {
  const v = aNumero(valor);
  if (v === null) return false;

  const o = regla.operador;
  const ref = aNumero(regla.valor_referencia_numerico);
  const min = aNumero(regla.valor_min);
  const max = aNumero(regla.valor_max);

  if (o === '>') return ref !== null && v > ref;
  if (o === '>=') return ref !== null && v >= ref;
  if (o === '<') return ref !== null && v < ref;
  if (o === '<=') return ref !== null && v <= ref;
  if (o === '=') return ref !== null && v === ref;
  if (o === 'entre') return min !== null && max !== null && v >= min && v <= max;
  if (o === 'fuera_de_rango')
    return min !== null && max !== null && (v < min || v > max);
  return false;
}

/**
 * ¿El valor sigue DENTRO de la zona de alarma aplicando la histéresis?
 *
 * La histéresis estrecha la banda: para cerrar hace falta volver más adentro
 * de lo que se salió. Con banda 20–24 e histéresis 0,5:
 *
 *   - cerrar por abajo:   valor >= 20,5  (no basta con 20,0)
 *   - cerrar por arriba:  valor <= 23,5  (no basta con 24,0)
 *
 * Para comparaciones simples:
 *
 *   - `> 30` con histéresis 0,5 → se mantiene mientras valor > 29,5
 *   - `< 18` con histéresis 0,5 → se mantiene mientras valor < 18,5
 */
export function sigueEnAlarma(
  regla: ReglaEvaluable,
  valor: number | string | null | undefined
): boolean {
  const v = aNumero(valor);
  if (v === null) return false;

  const h = Math.abs(aNumero(regla.histeresis) ?? 0);
  if (h === 0) return cumpleCondicion(regla, v);

  const o = regla.operador;
  const ref = aNumero(regla.valor_referencia_numerico);
  const min = aNumero(regla.valor_min);
  const max = aNumero(regla.valor_max);

  if (o === '>') return ref !== null && v > ref - h;
  if (o === '>=') return ref !== null && v >= ref - h;
  if (o === '<') return ref !== null && v < ref + h;
  if (o === '<=') return ref !== null && v <= ref + h;

  if (o === 'fuera_de_rango') {
    if (min === null || max === null) return false;
    // Se cierra solo cuando el valor entra en la banda estrechada.
    return v < min + h || v > max - h;
  }

  if (o === 'entre') {
    if (min === null || max === null) return false;
    // Alarma mientras está dentro; cierra al salir de la banda ensanchada.
    return v >= min - h && v <= max + h;
  }

  return cumpleCondicion(regla, v);
}

/**
 * Decide qué hacer con una medición.
 *
 * @param regla     Regla con retardo e histéresis.
 * @param valor     Valor numérico medido.
 * @param ahora     Instante de la medición (se pasa, no se lee el reloj).
 * @param abierta   Alerta abierta de esta regla, si la hay.
 */
export function decidirEvaluacion(
  regla: ReglaEvaluable,
  valor: number | string | null | undefined,
  ahora: Date,
  abierta: AlertaAbierta | null
): DecisionEvaluacion {
  const retardo = Math.max(0, aNumero(regla.retardo_segundos) ?? 0);

  // ── Hay una alerta abierta ──
  if (abierta) {
    /*
     * Se usa la histéresis, no la condición pura: mientras el valor siga en
     * la zona de alarma ampliada, la alerta se mantiene aunque ya no cumpla
     * la condición original. Ese es justo el punto.
     */
    if (sigueEnAlarma(regla, valor)) return { accion: 'mantener', motivo: 'histeresis' };
    return { accion: 'resolver' };
  }

  // ── No hay alerta abierta ──
  if (!cumpleCondicion(regla, valor)) return { accion: 'nada' };

  /*
   * RETARDO en el borde de apertura.
   *
   * No hay alerta previa, así que tampoco hay «instante en que empezó a
   * cumplirse». Se aproxima con la hora de la medición: la condición cuenta
   * como recién cumplida. El llamador es quien persiste ese instante entre
   * mediciones (ver `estadoRetardo` en el servicio).
   */
  if (retardo > 0) {
    return { accion: 'esperar', segundosTranscurridos: 0 };
  }

  void ahora;
  return { accion: 'abrir' };
}

/**
 * Decide con un instante de inicio explícito.
 *
 * Es la variante que usa el servicio, que sí guarda `desde_cuando` para cada
 * regla que está esperando el retardo. `decidirEvaluacion` existe para los
 * casos sencillos y las pruebas.
 *
 * @param desdeCuando Instante en que la condición empezó a cumplirse.
 */
export function decidirConRetardo(
  regla: ReglaEvaluable,
  valor: number | string | null | undefined,
  ahora: Date,
  abierta: AlertaAbierta | null,
  desdeCuando: Date | null
): DecisionEvaluacion {
  const retardo = Math.max(0, aNumero(regla.retardo_segundos) ?? 0);

  // Hay alerta abierta: solo puede mantenerse o resolverse.
  if (abierta) {
    if (sigueEnAlarma(regla, valor)) return { accion: 'mantener', motivo: 'histeresis' };
    return { accion: 'resolver' };
  }

  // No cumple: no hay nada que esperar.
  if (!cumpleCondicion(regla, valor)) return { accion: 'nada' };

  // Sin retardo: abre de inmediato.
  if (retardo === 0) return { accion: 'abrir' };

  // Con retardo: ¿cuánto lleva cumpliéndose?
  if (!desdeCuando) return { accion: 'esperar', segundosTranscurridos: 0 };

  const transcurridos = (ahora.getTime() - desdeCuando.getTime()) / 1000;
  if (transcurridos >= retardo) return { accion: 'abrir' };

  return { accion: 'esperar', segundosTranscurridos: Math.max(0, transcurridos) };
}
