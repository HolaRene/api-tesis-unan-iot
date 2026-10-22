/**
 * Detección de falla de lazo en sensores industriales.
 *
 * ──────────────────────────────────────────────────────────────────────
 * QUÉ ES UNA FALLA DE LAZO
 * ──────────────────────────────────────────────────────────────────────
 * En un lazo 4–20 mA, la corriente nunca baja de 4 mA en funcionamiento
 * normal: ese «cero vivo» es precisamente lo que distingue una medida de
 * cero de un cable roto.
 *
 *     > 20,5 mA  → sobre-rango
 *     4–20 mA    → medida válida
 *     3,6–4 mA   → por debajo del rango (aviso)
 *     < 3,6 mA   → FALLA: cable corto, sensor averiado o sin alimentación
 *
 * Son los umbrales de NAMUR NE 43. La idea clave es que una corriente
 * anómalamente baja **no es una medida baja**: es una avería.
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTE ARCHIVO EXISTE
 * ──────────────────────────────────────────────────────────────────────
 * Antes la API guardaba toda medición con `calidad: 'good'`, sin mirar el
 * valor. El PLC simulado marca la falla enviando **-32768** (el mínimo de un
 * entero de 16 bits), y ese -32768 entraba como una temperatura real de
 * -32768 °C. Con una regla «temperatura por debajo de 18 °C», un sensor
 * averiado generaba una alerta de **temperatura baja**.
 *
 * Es el peor resultado posible: el operario recibe un aviso que describe mal
 * el problema y tapa el verdadero.
 *
 * ──────────────────────────────────────────────────────────────────────
 * CÓMO SE USA
 * ──────────────────────────────────────────────────────────────────────
 * Con las mediciones reales de 4–20 mA, la detección es por corriente: es lo
 * que manda la norma. El centinela -32768 se mantiene como **respaldo** para
 * señales que no vienen de un lazo de corriente (un ESP32 por MQTT, por
 * ejemplo), donde no hay mA que interpretar.
 */

/** Valor centinela que usa el PLC simulado para señalar la falla. */
export const VALOR_CENTINELA_FALLA = -32768;

/** Umbrales de NAMUR NE 43, en miliamperios. */
export const NAMUR = {
  /** Por debajo de esto, falla de lazo. */
  FALLA_MA: 3.6,
  /** Fin de escala inferior. */
  MIN_MA: 4,
  /** Fin de escala superior. */
  MAX_MA: 20,
  /** Por encima, sobre-rango. */
  SOBRE_RANGO_MA: 20.5,
} as const;

export type CalidadMedicion = 'good' | 'bad' | 'uncertain';

export interface DiagnosticoLazo {
  /** Calidad a guardar en la base de datos. */
  calidad: CalidadMedicion;
  /** true si hay que abrir una alerta de falla de lazo. */
  falla: boolean;
  /** Motivo legible, para meter en `metadatos`. */
  motivo: string | null;
  /** Cómo se detectó: por corriente o por el centinela. */
  deteccion: 'corriente' | 'centinela' | null;
}

export interface OpcionesFalla {
  /**
   * true si el canal representa una corriente en mA. Solo entonces se
   * aplican los umbrales de NAMUR.
   */
  esCorriente?: boolean;
  /** Activa la detección del centinela -32768 (respaldo). */
  centinela?: boolean;
}

/**
 * Diagnostica el valor recibido.
 *
 * Devuelve siempre un resultado; nunca lanza. La ingesta no debe caerse
 * porque un sensor esté averiado: al contrario, ese es el momento en que
 * tiene que funcionar.
 */
export function diagnosticarValor(
  valor: number | null | undefined,
  opciones: OpcionesFalla = {}
): DiagnosticoLazo {
  const { esCorriente = false, centinela = true } = opciones;

  if (valor === null || valor === undefined || !Number.isFinite(valor)) {
    return {
      calidad: 'bad',
      falla: true,
      motivo: 'valor no numérico',
      deteccion: null,
    };
  }

  // 1) Centinela del PLC simulado.
  if (centinela && valor === VALOR_CENTINELA_FALLA) {
    return {
      calidad: 'bad',
      falla: true,
      motivo: 'falla de lazo (valor centinela -32768)',
      deteccion: 'centinela',
    };
  }

  // 2) Umbrales de lazo de corriente, si el canal es de mA.
  if (esCorriente) {
    if (valor < NAMUR.FALLA_MA) {
      return {
        calidad: 'bad',
        falla: true,
        motivo: `falla de lazo: ${valor} mA por debajo de ${NAMUR.FALLA_MA} mA (NAMUR NE 43)`,
        deteccion: 'corriente',
      };
    }
    if (valor < NAMUR.MIN_MA) {
      return {
        calidad: 'uncertain',
        falla: false,
        motivo: `por debajo del rango: ${valor} mA (< ${NAMUR.MIN_MA} mA)`,
        deteccion: 'corriente',
      };
    }
    if (valor > NAMUR.SOBRE_RANGO_MA) {
      return {
        calidad: 'uncertain',
        falla: false,
        motivo: `sobre-rango: ${valor} mA (> ${NAMUR.SOBRE_RANGO_MA} mA)`,
        deteccion: 'corriente',
      };
    }
  }

  return { calidad: 'good', falla: false, motivo: null, deteccion: null };
}

/** ¿Una medición con esta calidad debe evaluarse contra reglas de umbral? */
export function evaluarUmbral(calidad: string | null | undefined): boolean {
  /*
   * Solo las buenas. Evaluar una medición en falla contra un umbral produce
   * alarmas que describen mal el problema: el sensor está roto, no hace frío.
   *
   * Las `uncertain` SÍ se evalúan: un sobre-rango es una medida real, solo
   * que fuera de escala.
   */
  return (calidad ?? 'good').toLowerCase() === 'good' ||
    (calidad ?? '').toLowerCase() === 'uncertain';
}

/** Nombre del tipo de alerta de falla, para distinguirla de un umbral. */
export const TIPO_ALERTA_FALLA_LAZO = 'falla_lazo';
